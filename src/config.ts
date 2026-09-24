// guardhook — project configuration.
//
// A safety gate that can't be tuned gets uninstalled. `.guardhook.json` lets a
// project override the built-in decision on a per-command / per-path basis:
//
//   {
//     "mode": "block",                     // "block" (default) | "ask"
//     "allow": ["^terraform destroy"],     // regex: matching Bash cmd -> allow
//                                          //   (escape hatch — overrides a
//                                          //    built-in deny/ask; use sparingly)
//     "deny":  ["^kubectl .*delete ns"],   // regex: matching Bash cmd -> deny
//     "ask":   ["^git push .*origin main"],// regex: matching Bash cmd -> ask
//     "allowTitles": ["Force-push"],       // silence a built-in rule by title
//     "sensitivePaths": ["\\.tfstate$"]    // extra file patterns to guard on Write/Edit
//   }
//
// Precedence for a Bash command:  user deny > user allow > user ask > built-in.
// A user `allow` can override a built-in `deny` on purpose (that is the whole
// point of an escape hatch); a user `deny` can escalate something the built-in
// engine would have let through. Safety-first ties: if a command matches both a
// user deny and a user allow, deny wins.
//
// Loading is fail-open: a missing / malformed / unreadable config is treated as
// "no config" and never breaks the agent.

import { readFileSync } from "node:fs";
import { join, parse } from "node:path";

export interface RawConfig {
  mode?: "block" | "ask";
  allow?: string[];
  deny?: string[];
  ask?: string[];
  allowTitles?: string[];
  sensitivePaths?: string[];
}

export interface Config {
  mode?: "block" | "ask";
  allow: RegExp[];
  deny: RegExp[];
  ask: RegExp[];
  allowTitles: Set<string>;
  sensitivePaths: RegExp[];
}

export const EMPTY_CONFIG: Config = {
  allow: [],
  deny: [],
  ask: [],
  allowTitles: new Set(),
  sensitivePaths: [],
};

function compile(patterns: unknown): RegExp[] {
  if (!Array.isArray(patterns)) return [];
  const out: RegExp[] = [];
  for (const p of patterns) {
    if (typeof p !== "string" || !p) continue;
    try {
      out.push(new RegExp(p));
    } catch {
      // skip an invalid pattern rather than break the whole config
    }
  }
  return out;
}

// Turn a parsed JSON object into a compiled Config. Exported for testing.
export function fromRaw(raw: RawConfig): Config {
  return {
    mode: raw.mode === "ask" || raw.mode === "block" ? raw.mode : undefined,
    allow: compile(raw.allow),
    deny: compile(raw.deny),
    ask: compile(raw.ask),
    allowTitles: new Set(
      Array.isArray(raw.allowTitles) ? raw.allowTitles.filter((t) => typeof t === "string") : [],
    ),
    sensitivePaths: compile(raw.sensitivePaths),
  };
}

// Walk up from `startDir` looking for `.guardhook.json`; return the first one
// found, compiled. Never throws — returns EMPTY_CONFIG if none/invalid.
export function loadConfig(startDir: string = process.cwd()): Config {
  let dir = startDir;
  const { root } = parse(dir);
  for (;;) {
    try {
      const text = readFileSync(join(dir, ".guardhook.json"), "utf8");
      return fromRaw(JSON.parse(text) as RawConfig);
    } catch {
      // not here (or unreadable/malformed) — keep walking up
    }
    if (dir === root) break;
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return EMPTY_CONFIG;
}
