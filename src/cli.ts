#!/usr/bin/env node
// guardhook — CLI entrypoint.

import { runHook } from "./hook.js";
import { classifyCommand } from "./engine.js";
import { gate } from "./tiers.js";
import { runInit } from "./init.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const VERSION: string = (() => {
  try {
    return require("../package.json").version;
  } catch {
    return "0.0.0";
  }
})();

const HELP = `guardhook v${VERSION} — the seatbelt for coding agents.

A safety hook for Claude Code (and the Agent SDK). It runs before every Bash /
Write / Edit tool call and blocks genuinely destructive commands (rm -rf /,
curl | sudo bash, force-push to main, dd/mkfs to a disk, fork bombs, …) and
credential leaks — before they run.

Built & maintained by an autonomous AI agent (Aurelio Nakamura).

Usage:
  guardhook init [--global] [--npx] [--mode ask]
        Install the guard into .claude/settings.json (project) or
        ~/.claude/settings.json (--global). --npx uses npx so no global
        install is needed. --mode ask confirms dangerous commands instead of
        blocking them outright.

  guardhook hook [--mode ask]
        The hook itself: reads a PreToolUse event as JSON on stdin and prints a
        permission decision. You normally don't call this by hand — 'init'
        wires it up.

  guardhook check "<command>"
        Print how the guard would classify a shell command (handy for testing).

  guardhook --version | --help
`;

function parseMode(args: string[]): "block" | "ask" {
  const i = args.indexOf("--mode");
  if (i >= 0 && args[i + 1] === "ask") return "ask";
  return "block";
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") {
    process.stdout.write(HELP);
    return 0;
  }
  if (cmd === "--version" || cmd === "-v" || cmd === "version") {
    process.stdout.write(VERSION + "\n");
    return 0;
  }

  if (cmd === "hook") {
    await runHook(process.stdin, process.stdout, { mode: parseMode(args) });
    return 0;
  }

  if (cmd === "init") {
    const res = await runInit({
      global: args.includes("--global"),
      npx: args.includes("--npx"),
      mode: parseMode(args),
    });
    if (res.changed) {
      process.stdout.write(
        `✅ guardhook installed.\n   ${res.path}\n   hook: ${res.command}\n\nRestart Claude Code (or run /hooks) so it picks up the change.\n`,
      );
    } else {
      process.stdout.write(
        `ℹ️  guardhook is already installed in ${res.path} — nothing to do.\n`,
      );
    }
    return 0;
  }

  if (cmd === "check") {
    const command = args.slice(1).filter((a) => a !== "--mode" && a !== "ask" && a !== "block").join(" ");
    if (!command) {
      process.stderr.write('Usage: guardhook check "<command>"\n');
      return 2;
    }
    const { gate: g, reasons } = gate(classifyCommand(command));
    const label = g === "deny" ? "⛔ DENY " : g === "ask" ? "⚠️  ASK " : "✅ ALLOW";
    process.stdout.write(`${label}  ${command}\n`);
    for (const f of reasons) process.stdout.write(`   - ${f.title}: ${f.detail}\n`);
    return g === "deny" ? 1 : 0;
  }

  process.stderr.write(`Unknown command: ${cmd}\n\n${HELP}`);
  return 2;
}

main().then(
  (code) => process.exit(code),
  () => process.exit(1),
);
