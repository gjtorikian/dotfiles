/**
 * oh-pi Custom Header — minimal one-line startup identity.
 *
 * The version/model/think/prompts/skills table was removed; pi's built-in
 * "Package Updates Available" notice (a separate chat notification) is what
 * surfaces package updates on its own.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { VERSION } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    ctx.ui.setHeader((_tui, theme) => ({
      render(width: number): string[] {
        const logo = theme.bold(theme.fg("accent", "pi")) + theme.fg("dim", ` v${VERSION}`);
        return ["", logo, theme.fg("dim", "─".repeat(width))];
      },
      invalidate() {},
    }));
  });
}
