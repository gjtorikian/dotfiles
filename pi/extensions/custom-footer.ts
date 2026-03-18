/**
 * Custom Footer Extension — Enhanced status bar
 *
 * Displays the active model plus all-model local usage rollups for the
 * current session, last 24 hours, and last 7 days. Anthropic also shows
 * account windows (5h / 7d) when OAuth usage is available.
 */

import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth } from "@mariozechner/pi-tui";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

interface AuthEntry {
	type?: string;
	access?: string;
}

interface AuthFile {
	[provider: string]: AuthEntry | undefined;
}

interface UsageWindow {
	label: string;
	remainingPct: number;
	resetsAt: string;
}

interface UsageTotals {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	totalTokens: number;
	cost: number;
}

interface UsageRollups {
	day: UsageTotals;
	week: UsageTotals;
}

type RemoteUsage =
	| {
			kind: "windows";
			label: string;
			windows: UsageWindow[];
	  }
	| null;

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

// Module-level state for cross-event communication (cleared on reload)
let currentTuiInstance: { requestRender: () => void } | null = null;
let activeModelSelection: ActiveModelSelection = {
	provider: "",
	id: "no-model",
	contextWindow: 0,
};

function getAgentDir(): string {
	const configured = process.env.PI_CODING_AGENT_DIR;
	if (!configured) return join(homedir(), ".pi", "agent");
	if (configured === "~") return homedir();
	if (configured.startsWith("~/")) return join(homedir(), configured.slice(2));
	return configured;
}

function readAuthFile(): AuthFile {
	const path = join(getAgentDir(), "auth.json");
	if (!existsSync(path)) return {};

	try {
		return JSON.parse(readFileSync(path, "utf8")) as AuthFile;
	} catch {
		return {};
	}
}

function getOAuthAccessToken(provider: string): string | null {
	const entry = readAuthFile()[provider];
	if (entry?.type !== "oauth") return null;
	return typeof entry.access === "string" && entry.access ? entry.access : null;
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

function emptyTotals(): UsageTotals {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: 0,
	};
}

function emptyRollups(): UsageRollups {
	return {
		day: emptyTotals(),
		week: emptyTotals(),
	};
}

function addMessageUsage(totals: UsageTotals, message: AssistantMessage): void {
	if (!message.usage) return;

	totals.input += message.usage.input || 0;
	totals.output += message.usage.output || 0;
	totals.cacheRead += message.usage.cacheRead || 0;
	totals.cacheWrite += message.usage.cacheWrite || 0;
	totals.totalTokens += message.usage.totalTokens || 0;
	totals.cost += message.usage.cost?.total || 0;
}

function addTotals(target: UsageTotals, source: UsageTotals): void {
	target.input += source.input;
	target.output += source.output;
	target.cacheRead += source.cacheRead;
	target.cacheWrite += source.cacheWrite;
	target.totalTokens += source.totalTokens;
	target.cost += source.cost;
}

function mergeTotals(a: UsageTotals, b: UsageTotals): UsageTotals {
	const merged = emptyTotals();
	addTotals(merged, a);
	addTotals(merged, b);
	return merged;
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

function collectUsageTotals(
	entries: any[],
	match?: (message: AssistantMessage) => boolean,
): UsageTotals {
	const totals = emptyTotals();

	for (const entry of entries) {
		if (entry.type !== "message" || entry.message.role !== "assistant") continue;
		const message = entry.message as AssistantMessage;
		if (match && !match(message)) continue;
		addMessageUsage(totals, message);
	}

	return totals;
}

function collectUsageRollups(
	entries: any[],
	now: number,
	match?: (message: AssistantMessage) => boolean,
): UsageRollups {
	const rollups = emptyRollups();
	const dayCutoff = now - DAY_MS;
	const weekCutoff = now - WEEK_MS;

	for (const entry of entries) {
		if (entry.type !== "message" || entry.message.role !== "assistant") continue;

		const timestamp = getEntryTimestamp(entry);
		if (!timestamp || timestamp < weekCutoff) continue;

		const message = entry.message as AssistantMessage;
		if (match && !match(message)) continue;
		addMessageUsage(rollups.week, message);
		if (timestamp >= dayCutoff) addMessageUsage(rollups.day, message);
	}

	return rollups;
}

function listSessionFiles(dir: string, excludeFile?: string): string[] {
	if (!existsSync(dir)) return [];

	const paths: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) paths.push(...listSessionFiles(path, excludeFile));
		if (entry.isFile() && path.endsWith(".jsonl") && path !== excludeFile) paths.push(path);
	}
	return paths;
}

function collectUsageRollupsFromFiles(
	sessionsDir: string,
	now: number,
	excludeFile?: string,
	match?: (message: AssistantMessage) => boolean,
): UsageRollups {
	const rollups = emptyRollups();
	const dayCutoff = now - DAY_MS;
	const weekCutoff = now - WEEK_MS;
	const files = listSessionFiles(sessionsDir, excludeFile);

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
			addMessageUsage(rollups.week, message);
			if (timestamp >= dayCutoff) addMessageUsage(rollups.day, message);
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
			kind: "windows",
			label: "Claude",
			windows: [
				{
					label: "5h",
					remainingPct: clampPercent(100 - data.five_hour.utilization),
					resetsAt: data.five_hour.resets_at ?? "",
				},
				{
					label: "7d",
					remainingPct: clampPercent(100 - data.seven_day.utilization),
					resetsAt: data.seven_day.resets_at ?? "",
				},
			],
		};
	} catch {
		return null;
	}
}

function buildUsageBar(
	remaining: number,
	label: string,
	timeUntil: string,
	theme: any,
): string {
	const barWidth = 5;
	const filled = Math.max(0, Math.min(barWidth, Math.round((remaining * barWidth) / 100)));
	const empty = barWidth - filled;
	const barColor = remaining > 50 ? "success" : remaining > 20 ? "warning" : "error";
	const bar = "━".repeat(filled) + "╌".repeat(empty);

	return (
		theme.fg("muted", label) +
		" " +
		theme.fg(barColor, bar) +
		" " +
		theme.fg(barColor, `${remaining}%`) +
		theme.fg("dim", ` ↻${timeUntil}`)
	);
}

function renderRemoteUsage(usage: Exclude<RemoteUsage, null>, theme: any): string {
	const parts = usage.windows.map((window) =>
		buildUsageBar(window.remainingPct, window.label, formatTimeUntil(window.resetsAt), theme),
	);
	return theme.fg("muted", usage.label) + " " + parts.join(theme.fg("dim", " ╱ "));
}

function fmtCost(n: number): string {
	const abs = Math.abs(n);
	if (abs === 0) return "$0";
	if (abs < 0.01) return "<¢1";
	if (abs < 1) return `¢${Math.round(abs * 100)}`;
	if (abs < 1000) return `$${n.toFixed(2).replace(/\.00$/, "")}`;
	if (abs < 1_000_000) return `$${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
	return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

function renderUsageSnapshot(label: string, stats: UsageTotals, theme: any): string {
	const parts = [theme.fg("accent", `${fmt(stats.input)}/${fmt(stats.output)}`)];
	// Show cost with compact formatting; use (nc) for providers that don't report cost
	const costStr = stats.cost === 0 ? "(nc)" : fmtCost(stats.cost);
	parts.push(theme.fg("warning", costStr));
	return theme.fg("muted", label) + " " + parts.join(" ");
}

function getContextPercent(
	usage: { tokens: number | null; percent: number | null; contextWindow: number } | undefined,
	contextWindow: number,
): number | null {
	if (!usage) return null;
	if (usage.tokens != null && contextWindow > 0) {
		return (usage.tokens / contextWindow) * 100;
	}
	return usage.percent;
}

function renderContextUsage(percent: number | null, theme: any): string {
	if (percent == null) return theme.fg("muted", "ctx ?");
	const pctColor = percent > 75 ? "error" : percent > 50 ? "warning" : "success";
	return theme.fg("muted", "ctx") + " " + theme.fg(pctColor, `${percent.toFixed(0)}%`);
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

		function getCachedHistoricalUsage(
			now: number,
			provider: string,
			modelId: string,
		): UsageRollups {
			const currentSessionFile = ctx.sessionManager.getSessionFile?.() ?? undefined;
			if (currentSessionFile !== excludedSessionFile) {
				excludedSessionFile = currentSessionFile;
				localUsageCache.clear();
			}

			const cacheKey = `${provider}:${modelId}`;
			const cached = localUsageCache.get(cacheKey);
			if (cached && Date.now() - cached.fetchedAt < USAGE_CACHE_TTL) {
				return cached.data;
			}

			const match = (message: AssistantMessage) =>
				message.provider === provider && message.model === modelId;
			const data = collectUsageRollupsFromFiles(sessionsDir, now, currentSessionFile, match);
			localUsageCache.set(cacheKey, { data, fetchedAt: Date.now() });
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
				invalidate() {},
				render(width: number): string[] {
					const branch = ctx.sessionManager.getBranch();
					const provider = activeModelSelection.provider;
					const modelId = activeModelSelection.id;
					const now = Date.now();

					refreshRemoteUsageIfStale(provider, () => tui.requestRender());

					const isActiveModel = (message: AssistantMessage) =>
						message.provider === provider && message.model === modelId;

					// Usage stats: current model only (changes when you switch models)
					const sessionStats = collectUsageTotals(branch, isActiveModel);
					const branchRollups = collectUsageRollups(branch, now, isActiveModel);
					const historicalRollups = getCachedHistoricalUsage(now, provider, modelId);
					const dayStats = mergeTotals(historicalRollups.day, branchRollups.day);
					const weekStats = mergeTotals(historicalRollups.week, branchRollups.week);

					const usage = ctx.getContextUsage();
					const pct = getContextPercent(
						usage,
						activeModelSelection.contextWindow || usage?.contextWindow || 0,
					);
					const contextStr = renderContextUsage(pct, theme);
					const thinking = pi.getThinkingLevel();
					const thinkColor =
						thinking === "high"
							? "warning"
							: thinking === "medium"
								? "accent"
								: thinking === "low"
									? "dim"
									: "muted";
					const modelStr =
						theme.fg(thinkColor, getModelIcon(modelId)) + " " + theme.fg("accent", modelId);

					const leftParts = [
						modelStr,
						renderUsageSnapshot("sess", sessionStats, theme),
						renderUsageSnapshot("24h", dayStats, theme),
						renderUsageSnapshot("7d", weekStats, theme),
						contextStr,
					];

					const remoteUsage = getCacheEntry(provider).data;
					if (remoteUsage) leftParts.push(renderRemoteUsage(remoteUsage, theme));

					const sep = theme.fg("dim", " | ");
					return [truncateToWidth(leftParts.join(sep), width)];
				},
			};
		});
	});
}
