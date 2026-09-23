// guardhook — `init`: install the guard into Claude Code settings.
//
// Merges a PreToolUse hook into .claude/settings.json (project) or
// ~/.claude/settings.json (--global) without clobbering existing hooks. Safe to
// re-run: it will not add a duplicate guardhook entry.

import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export interface InitOptions {
  global?: boolean;
  npx?: boolean; // use `npx -y guardhook hook` instead of a bare binary
  mode?: "block" | "ask";
  cwd?: string;
}

const MARK = "guardhook";

export function hookCommand(opts: InitOptions): string {
  const base = opts.npx ? "npx -y guardhook hook" : "guardhook hook";
  return opts.mode === "ask" ? `${base} --mode ask` : base;
}

export function settingsPath(opts: InitOptions): string {
  if (opts.global) return path.join(os.homedir(), ".claude", "settings.json");
  return path.join(opts.cwd ?? process.cwd(), ".claude", "settings.json");
}

type Json = Record<string, any>;

// Merge our matchers into an existing settings object. Returns [next, changed].
export function mergeSettings(settings: Json, command: string): [Json, boolean] {
  const next: Json = { ...settings };
  next.hooks = { ...(next.hooks ?? {}) };
  const existing: any[] = Array.isArray(next.hooks.PreToolUse) ? next.hooks.PreToolUse : [];

  const already = JSON.stringify(existing).includes(MARK);
  if (already) return [next, false];

  const entry = {
    matcher: "Bash|Write|Edit|MultiEdit|NotebookEdit",
    hooks: [{ type: "command", command }],
  };
  next.hooks.PreToolUse = [...existing, entry];
  return [next, true];
}

export async function runInit(opts: InitOptions): Promise<{ path: string; changed: boolean; command: string }> {
  const p = settingsPath(opts);
  const command = hookCommand(opts);
  let settings: Json = {};
  try {
    settings = JSON.parse(await fs.readFile(p, "utf8"));
  } catch {
    settings = {};
  }
  const [next, changed] = mergeSettings(settings, command);
  if (changed) {
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, JSON.stringify(next, null, 2) + "\n", "utf8");
  }
  return { path: p, changed, command };
}
