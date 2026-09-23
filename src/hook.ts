// agent-seatbelt — the PreToolUse hook decision.
//
// Claude Code (and the Agent SDK) invoke a PreToolUse hook right BEFORE a tool
// runs, passing a JSON event on stdin. We inspect Bash/Edit/Write calls and
// return a permission decision:
//   - deny  -> the tool call is blocked, the reason is shown to the agent
//   - ask   -> the user is prompted to confirm
//   - (none)-> we stay silent and let Claude Code's normal permission flow run
//
// The whole thing is fail-open: anything unexpected -> stay silent. A guard
// that breaks the agent on its own bugs is worse than no guard.

import { classifyCommand } from "./engine.js";
import { scanSecrets, isSensitivePath } from "./secrets.js";

export type Behavior = "deny" | "ask" | "allow";

export interface HookInput {
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

export interface Options {
  // What to do with a genuinely-destructive command. "block" -> deny,
  // "ask" -> prompt for confirmation. Cautions always ask. Default: block.
  mode?: "block" | "ask";
}

export interface Decision {
  permissionDecision: Behavior;
  reason: string;
}

const BASH_TOOLS = new Set(["Bash", "BashOutput"]);
const EDIT_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit", "Update"]);

function textFromEditInput(ti: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const k of ["content", "new_string", "new_str", "new_source"]) {
    const v = ti[k];
    if (typeof v === "string") parts.push(v);
  }
  // MultiEdit: edits: [{new_string}]
  const edits = ti["edits"];
  if (Array.isArray(edits)) {
    for (const e of edits) {
      const v = e && (e.new_string ?? e.new_str);
      if (typeof v === "string") parts.push(v);
    }
  }
  return parts.join("\n");
}

function filePathOf(ti: Record<string, unknown>): string {
  for (const k of ["file_path", "path", "notebook_path", "filePath"]) {
    const v = ti[k];
    if (typeof v === "string") return v;
  }
  return "";
}

// Compute the guard decision for one hook event. Returns null to stay silent.
export function decide(input: HookInput, opts: Options = {}): Decision | null {
  if (input.hook_event_name && input.hook_event_name !== "PreToolUse") return null;
  const tool = input.tool_name ?? "";
  const ti = (input.tool_input ?? {}) as Record<string, unknown>;
  const mode = opts.mode ?? "block";

  if (BASH_TOOLS.has(tool)) {
    const command = typeof ti.command === "string" ? ti.command : "";
    if (!command.trim()) return null;
    const { risk, findings } = classifyCommand(command);
    if (risk === "danger") {
      const summary = findings
        .filter((f) => f.level === "danger")
        .map((f) => `- ${f.title}: ${f.detail}`)
        .join("\n");
      return {
        permissionDecision: mode === "ask" ? "ask" : "deny",
        reason: `agent-seatbelt flagged a destructive command:\n${summary}\n\nCommand: ${command}`,
      };
    }
    if (risk === "caution") {
      const summary = findings.map((f) => `- ${f.title}: ${f.detail}`).join("\n");
      return {
        permissionDecision: "ask",
        reason: `agent-seatbelt: this command needs a second look:\n${summary}\n\nCommand: ${command}`,
      };
    }
    return null;
  }

  if (EDIT_TOOLS.has(tool)) {
    const fp = filePathOf(ti);
    const reasons: string[] = [];
    if (isSensitivePath(fp)) {
      reasons.push(`writing to a sensitive file (${fp})`);
    }
    const hits = scanSecrets(textFromEditInput(ti));
    if (hits.length) {
      reasons.push(`the content looks like it contains a live secret (${hits.map((h) => h.name).join(", ")})`);
    }
    if (reasons.length) {
      return {
        permissionDecision: "ask",
        reason: `agent-seatbelt: ${reasons.join("; ")}. Confirm this is intentional and not a leaked credential.`,
      };
    }
  }

  return null;
}

// Serialize a decision into the JSON Claude Code expects on stdout.
export function toHookOutput(decision: Decision): string {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision.permissionDecision,
      permissionDecisionReason: decision.reason,
    },
  });
}

// Read all of stdin, decide, and emit the JSON (or nothing). Never throws.
export async function runHook(stdin: NodeJS.ReadableStream, stdout: NodeJS.WritableStream, opts: Options = {}): Promise<void> {
  let raw = "";
  try {
    for await (const chunk of stdin) raw += chunk;
    const input = JSON.parse(raw) as HookInput;
    const decision = decide(input, opts);
    if (decision) stdout.write(toHookOutput(decision));
  } catch {
    // fail-open: stay silent
  }
}
