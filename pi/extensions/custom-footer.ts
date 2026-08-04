/**
 * Custom Footer Extension — Enhanced status bar
 *
 * Every figure is a "how close am I to the wall" meter: percent used, with a
 * bar and the absolute token count beside it.
 *
 *   ctx  — current context-window occupancy for the active model
 *   24h  — provider-scoped tokens in the last 24h, against `usageBudgets.day`
 *   7d   — provider-scoped tokens in the last 7 days, against `usageBudgets.week`
 *
 * When a provider reports real quota windows (Anthropic OAuth exposes 5h / 7d
 * utilization), those replace the budget-based rollups — a real limit beats a
 * self-imposed one. Costs are deliberately not shown.
 */

import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

interface AuthEntry {
	type?: string;
	access?: string;
}

interface AuthFile {
	[provider: string]: AuthEntry | undefined;
}

/** A quota window reported by the provider itself. */
interface UsageWindow {
	label: string;
	usedPct: number;
	resetsAt: string;
}

/** Total tokens (input + output + cache) over each trailing window. */
interface UsageRollups {
	day: number;
	week: number;
}

/**
 * Self-imposed token budgets, read from `usageBudgets` in settings.json.
 * pi preserves unknown settings keys on write, so this survives its own saves.
 */
interface UsageBudgets {
	day: number;
	week: number;
}

type RemoteUsage = { windows: UsageWindow[] } | null;

interface CachedRemoteUsage {
	data: RemoteUsage;
	fetchedAt: number;
	inFlight: boolean;
}

interface CachedLocalUsage {
	data: UsageRollups;
	fetchedAt: number;
}

interface AnthropicUsageResponse {
	five_hour?: { utilization?: number; resets_at?: string };
	seven_day?: { utilization?: number; resets_at?: string };
}

interface ActiveModelSelection {
	provider: string;
	id: string;
	contextWindow: number;
}

const USAGE_CACHE_TTL = 120_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const METER_WIDTH = 6;

/** Tune these, or override with `usageBudgets` in settings.json. */
const DEFAULT_BUDGETS: UsageBudgets = {
	day: 40_000_000,
	week: 200_000_000,
};

// Module-level state for cross-event communication (cleared on reload)
let currentTuiInstance: { requestRender: () => void } | null = null;
let activeModelSelection: ActiveModelSelection = {
	provider: "",
	id: "no-model",
	contextWindow: 0,
};
let cachedBudgets: { data: UsageBudgets; fetchedAt: number } | null = null;

function getAgentDir(): string {
	const configured = process.env.PI_CODING_AGENT_DIR;
	if (!configured) return join(homedir(), ".pi", "agent");
	if (configured === "~") return homedir();
	if (configured.startsWith("~/")) return join(homedir(), configured.slice(2));
	return configured;
}

function readJsonFile<T>(path: string): T | null {
	if (!existsSync(path)) return null;

	try {
		return JSON.parse(readFileSync(path, "utf8")) as T;
	} catch {
		return null;
	}
}

function getOAuthAccessToken(provider: string): string | null {
	const auth = readJsonFile<AuthFile>(join(getAgentDir(), "auth.json")) ?? {};
	const entry = auth[provider];
	if (entry?.type !== "oauth") return null;
	return typeof entry.access === "string" && entry.access ? entry.access : null;
}

function positiveNumber(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function getBudgets(): UsageBudgets {
	if (cachedBudgets && Date.now() - cachedBudgets.fetchedAt < USAGE_CACHE_TTL) {
		return cachedBudgets.data;
	}

	const settings = readJsonFile<{ usageBudgets?: Partial<UsageBudgets> }>(
		join(getAgentDir(), "settings.json"),
	);
	const data: UsageBudgets = {
		day: positiveNumber(settings?.usageBudgets?.day, DEFAULT_BUDGETS.day),
		week: positiveNumber(settings?.usageBudgets?.week, DEFAULT_BUDGETS.week),
	};

	cachedBudgets = { data, fetchedAt: Date.now() };
	return data;
}

function clampPercent(value: number): number {
	return Math.max(0, Math.min(100, Math.round(value)));
}

function formatTimeUntil(resetsAt: string): string {
	if (!resetsAt) return "?";

	try {
		const resetEpoch = new Date(resetsAt).getTime();
		const now = Date.now();
		if (now >= resetEpoch) return "now";

		const secs = Math.floor((resetEpoch - now) / 1000);
		const mins = Math.floor(secs / 60);
		const hours = Math.floor(mins / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days}d${hours % 24}h`;
		if (hours > 0) return `${hours}h${mins % 60}m`;
		return `${mins}m`;
	} catch {
		return "?";
	}
}

function fmt(n: number): string {
	const abs = Math.abs(n);
	const units: Array<{ value: number; suffix: string }> = [
		{ value: 1_000_000_000, suffix: "B" },
		{ value: 1_000_000, suffix: "M" },
		{ value: 1_000, suffix: "k" },
	];

	for (const unit of units) {
		if (abs < unit.value) continue;
		const formatted = (n / unit.value).toFixed(1).replace(/\.0$/, "");
		return `${formatted}${unit.suffix}`;
	}

	return `${n}`;
}

/** Total billed tokens for one message; `totalTokens` already includes cache reads/writes. */
function messageTokens(message: AssistantMessage): number {
	const usage = message.usage;
	if (!usage) return 0;
	if (usage.totalTokens) return usage.totalTokens;
	return (
		(usage.input || 0) + (usage.output || 0) + (usage.cacheRead || 0) + (usage.cacheWrite || 0)
	);
}

function shortenModelId(modelId: string): string {
	const slash = modelId.lastIndexOf("/");
	return slash >= 0 ? modelId.slice(slash + 1) : modelId;
}

function getModelIcon(modelId: string): string {
	const id = modelId.toLowerCase();
	if (id.includes("kimi")) return "\u{f186}";
	if (id.includes("opus")) return "\u{f01e5}";
	if (id.includes("sonnet")) return "\u{f075a}";
	if (id.includes("haiku")) return "\u{f0735}";
	if (id.includes("gpt")) return "\u{f0768}";
	if (id.includes("gemini")) return "\u{f0ae2}";
	return "\u{f06a9}";
}

function getEntryTimestamp(entry: any): number {
	if (typeof entry?.timestamp === "string") {
		const parsed = Date.parse(entry.timestamp);
		if (Number.isFinite(parsed)) return parsed;
	}

	if (typeof entry?.message?.timestamp === "number") {
		return entry.message.timestamp;
	}

	return 0;
}

function collectUsageRollups(
	entries: any[],
	now: number,
	match?: (message: AssistantMessage) => boolean,
): UsageRollups {
	const rollups: UsageRollups = { day: 0, week: 0 };
	const dayCutoff = now - DAY_MS;
	const weekCutoff = now - WEEK_MS;

	for (const entry of entries) {
		if (entry.type !== "message" || entry.message.role !== "assistant") continue;

		const timestamp = getEntryTimestamp(entry);
		if (!timestamp || timestamp < weekCutoff) continue;

		const message = entry.message as AssistantMessage;
		if (match && !match(message)) continue;

		const tokens = messageTokens(message);
		rollups.week += tokens;
		if (timestamp >= dayCutoff) rollups.day += tokens;
	}

	return rollups;
}

function listSessionFiles(dir: string, excludeFile?: string, minMtimeMs?: number): string[] {
	if (!existsSync(dir)) return [];

	const paths: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) paths.push(...listSessionFiles(path, excludeFile, minMtimeMs));
		if (entry.isFile() && path.endsWith(".jsonl") && path !== excludeFile) {
			// Session files are append-only: a file not modified since the cutoff
			// cannot contain entries newer than the cutoff, so skip reading it.
			if (minMtimeMs !== undefined && statSync(path).mtimeMs < minMtimeMs) continue;
			paths.push(path);
		}
	}
	return paths;
}

function collectUsageRollupsFromFiles(
	sessionsDir: string,
	now: number,
	excludeFile?: string,
	match?: (message: AssistantMessage) => boolean,
): UsageRollups {
	const rollups: UsageRollups = { day: 0, week: 0 };
	const dayCutoff = now - DAY_MS;
	const weekCutoff = now - WEEK_MS;
	const files = listSessionFiles(sessionsDir, excludeFile, weekCutoff);

	for (const file of files) {
		let content = "";
		try {
			content = readFileSync(file, "utf8");
		} catch {
			continue;
		}

		for (const line of content.split("\n")) {
			if (!line.trim()) continue;

			let entry: any;
			try {
				entry = JSON.parse(line);
			} catch {
				continue;
			}

			if (entry.type !== "message" || entry.message?.role !== "assistant") continue;

			const timestamp = getEntryTimestamp(entry);
			if (!timestamp || timestamp < weekCutoff) continue;

			const message = entry.message as AssistantMessage;
			if (match && !match(message)) continue;

			const tokens = messageTokens(message);
			rollups.week += tokens;
			if (timestamp >= dayCutoff) rollups.day += tokens;
		}
	}

	return rollups;
}

async function fetchAnthropicUsage(): Promise<RemoteUsage> {
	const token = getOAuthAccessToken("anthropic");
	if (!token) return null;

	try {
		const resp = await fetch("https://api.anthropic.com/api/oauth/usage", {
			headers: {
				Authorization: `Bearer ${token}`,
				"anthropic-beta": "oauth-2025-04-20",
			},
			signal: AbortSignal.timeout(3000),
		});
		if (!resp.ok) return null;

		const data = (await resp.json()) as AnthropicUsageResponse;
		if (data?.five_hour?.utilization == null || data?.seven_day?.utilization == null) {
			return null;
		}

		return {
			windows: [
				{
					label: "5h",
					usedPct: clampPercent(data.five_hour.utilization),
					resetsAt: data.five_hour.resets_at ?? "",
				},
				{
					label: "7d",
					usedPct: clampPercent(data.seven_day.utilization),
					resetsAt: data.seven_day.resets_at ?? "",
				},
			],
		};
	} catch {
		return null;
	}
}

/**
 * One meter: `label ━━╌╌╌╌ 31% 12.4M`. `usedPct` of null means the ceiling is
 * unknown, so the bar is dropped and only the absolute figure survives.
 */
function renderMeter(
	label: string,
	usedPct: number | null,
	trailing: string,
	theme: any,
): string {
	const parts = [theme.fg("muted", label)];

	if (usedPct == null) {
		parts.push(theme.fg("dim", "—"));
	} else {
		const pct = clampPercent(usedPct);
		const filled = Math.max(0, Math.min(METER_WIDTH, Math.round((pct * METER_WIDTH) / 100)));
		const color = pct > 75 ? "error" : pct > 50 ? "warning" : "success";
		parts.push(theme.fg(color, "━".repeat(filled) + "╌".repeat(METER_WIDTH - filled)));
		parts.push(theme.fg(color, `${pct}%`));
	}

	if (trailing) parts.push(theme.fg("dim", trailing));
	return parts.join(" ");
}

function percentOf(used: number, budget: number): number | null {
	return budget > 0 ? (used / budget) * 100 : null;
}

export default function (pi: ExtensionAPI) {
	const remoteUsageCache = new Map<string, CachedRemoteUsage>();
	const remoteFetchers: Record<string, () => Promise<RemoteUsage>> = {
		anthropic: fetchAnthropicUsage,
	};

	function getCacheEntry(provider: string): CachedRemoteUsage {
		const cached = remoteUsageCache.get(provider);
		if (cached) return cached;

		const next = { data: null, fetchedAt: 0, inFlight: false };
		remoteUsageCache.set(provider, next);
		return next;
	}

	function refreshRemoteUsageIfStale(provider: string, onUpdate: () => void) {
		const fetcher = remoteFetchers[provider];
		if (!fetcher) return;

		const entry = getCacheEntry(provider);
		if (entry.inFlight) return;
		if (Date.now() - entry.fetchedAt < USAGE_CACHE_TTL) return;

		entry.inFlight = true;
		fetcher()
			.then((data) => {
				entry.data = data;
				entry.fetchedAt = Date.now();
				onUpdate();
			})
			.catch(() => {
				entry.fetchedAt = Date.now();
			})
			.finally(() => {
				entry.inFlight = false;
			});
	}

	pi.on("thinking_level_select", async () => {
		currentTuiInstance?.requestRender();
	});

	pi.on("model_select", async (event) => {
		activeModelSelection = {
			provider: event.model.provider,
			id: event.model.id,
			contextWindow: event.model.contextWindow ?? 0,
		};
		currentTuiInstance?.requestRender();
	});

	pi.on("session_start", async (_event, ctx) => {
		activeModelSelection = {
			provider: ctx.model?.provider || "",
			id: ctx.model?.id || "no-model",
			contextWindow: ctx.model?.contextWindow ?? 0,
		};
		const sessionsDir = join(getAgentDir(), "sessions");
		const localUsageCache = new Map<string, CachedLocalUsage>();
		let excludedSessionFile = ctx.sessionManager.getSessionFile?.() ?? undefined;

		function getCachedHistoricalUsage(now: number, provider: string): UsageRollups {
			const currentSessionFile = ctx.sessionManager.getSessionFile?.() ?? undefined;
			if (currentSessionFile !== excludedSessionFile) {
				excludedSessionFile = currentSessionFile;
				localUsageCache.clear();
			}

			const cached = localUsageCache.get(provider);
			if (cached && Date.now() - cached.fetchedAt < USAGE_CACHE_TTL) {
				return cached.data;
			}

			const match = (message: AssistantMessage) => message.provider === provider;
			const data = collectUsageRollupsFromFiles(sessionsDir, now, currentSessionFile, match);
			localUsageCache.set(provider, { data, fetchedAt: Date.now() });
			return data;
		}

		ctx.ui.setFooter((tui, theme, footerData) => {
			currentTuiInstance = tui;

			const unsub = footerData.onBranchChange(() => tui.requestRender());
			const interval = setInterval(() => tui.requestRender(), 60_000);

			return {
				dispose() {
					unsub();
					clearInterval(interval);
					currentTuiInstance = null;
				},
				invalidate() { },
				render(width: number): string[] {
					const branch = ctx.sessionManager.getBranch();
					const provider = activeModelSelection.provider;
					const modelId = activeModelSelection.id;
					const now = Date.now();

					refreshRemoteUsageIfStale(provider, () => tui.requestRender());

					const thinking = pi.getThinkingLevel();
					const modelStr =
						theme.fg("accent", getModelIcon(modelId)) +
						" " +
						theme.fg("accent", shortenModelId(modelId)) +
						theme.fg("muted", ` (${thinking})`);

					// Context: how full the window is right now, for this model.
					const usage = ctx.getContextUsage();
					const contextWindow =
						activeModelSelection.contextWindow || usage?.contextWindow || 0;
					const ctxPct =
						usage?.tokens != null && contextWindow > 0
							? (usage.tokens / contextWindow) * 100
							: (usage?.percent ?? null);
					const parts = [
						modelStr,
						renderMeter("ctx", ctxPct, usage?.tokens != null ? fmt(usage.tokens) : "", theme),
					];

					// Real provider quota wins; budget-based rollups are the fallback.
					const remoteUsage = getCacheEntry(provider).data;
					if (remoteUsage) {
						for (const window of remoteUsage.windows) {
							parts.push(
								renderMeter(
									window.label,
									window.usedPct,
									`↻${formatTimeUntil(window.resetsAt)}`,
									theme,
								),
							);
						}
					} else {
						// Provider-scoped, not model-scoped: a budget covers everything
						// you spend on that account, whichever model you switched to.
						const isActiveProvider = (message: AssistantMessage) =>
							message.provider === provider;
						const branchRollups = collectUsageRollups(branch, now, isActiveProvider);
						const historical = getCachedHistoricalUsage(now, provider);
						const day = historical.day + branchRollups.day;
						const week = historical.week + branchRollups.week;
						const budgets = getBudgets();

						parts.push(renderMeter("24h", percentOf(day, budgets.day), fmt(day), theme));
						parts.push(renderMeter("7d", percentOf(week, budgets.week), fmt(week), theme));
					}

					const sep = theme.fg("dim", " │ ");
					const contentLine = truncateToWidth(parts.join(sep), width);
					const barLine = theme.fg("accent", "─".repeat(width));
					return [barLine, contentLine];
				},
			};
		});
	});
}
