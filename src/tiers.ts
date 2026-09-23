// guardhook — gate tiers.
//
// cmdxray's danger engine is tuned to WARN a human ("this is a recursive
// delete"). guardhook is a GATE that must decide deny / ask / allow for an
// autonomous agent, so it needs its own, stricter-but-quieter calibration:
//
//   deny  — catastrophic, machine-scope, irreversible, or remote-code:
//           wiping a system root, writing/formatting a raw disk, a fork bomb,
//           piping unread code into a shell, killing init, etc.
//   ask   — risky but routine, worth a human glance: force-push, hard reset,
//           deleting untracked files, powering the box off.
//   allow — everything else, including ordinary `rm -rf node_modules` /
//           `rm -rf dist`. A guard that nags on every build-clean gets ripped
//           out; precision is the whole point.
//
// Titles come straight from cmdxray so this stays a thin, auditable mapping.

import type { Finding, Classification } from "./engine.js";

// Catastrophic — deny by default.
const BLOCK_TITLES = new Set<string>([
  "Wipes critical paths, no prompt", // rm -rf / , ~ , /etc, $HOME …
  "Disables the / safety guard", // --no-preserve-root
  "Raw write to a disk device",
  "Writes onto a disk device",
  "Destroys a disk device",
  "Formats a filesystem",
  "Fork bomb",
  "Runs downloaded code unread", // curl … | bash
  "Recursive chmod of a system path",
  "Truncates a critical system file",
  "Removes all cron jobs",
  "Signals every process / init",
  "Signals PID 1 (init)",
]);

// Risky but routine — confirm rather than block.
const ASK_TITLES = new Set<string>([
  "Force-push",
  "Hard reset",
  "Deletes untracked files",
  "Changes machine power state",
  "World-writable, recursively",
  "Runs as root",
]);

export type Gate = "deny" | "ask" | null;

// Reduce a classification to a single gate decision plus the findings that
// justified it.
export function gate(c: Classification): { gate: Gate; reasons: Finding[] } {
  const blockers = c.findings.filter((f) => BLOCK_TITLES.has(f.title));
  if (blockers.length) return { gate: "deny", reasons: blockers };
  const askers = c.findings.filter((f) => ASK_TITLES.has(f.title));
  if (askers.length) return { gate: "ask", reasons: askers };
  return { gate: null, reasons: [] };
}
