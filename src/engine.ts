// agent-seatbelt — command risk engine.
//
// The destructive-command classification is delegated to cmdxray's offline,
// zero-network danger engine (the same one that powers cmdxray's explainer,
// lint and MCP safety-gate). We keep this wrapper tiny and fail-open: if the
// engine throws for any reason, we report "no findings" rather than break the
// agent's workflow.

import { explain } from "cmdxray";

export type Risk = "danger" | "caution" | "none";

export interface Finding {
  level: "danger" | "caution";
  title: string;
  detail: string;
}

export interface Classification {
  risk: Risk;
  findings: Finding[];
}

// Classify a single shell command line into danger / caution / none.
export function classifyCommand(command: string): Classification {
  let findings: Finding[] = [];
  try {
    findings = explain(command).warnings.map((w) => ({
      level: w.level,
      title: w.title,
      detail: w.detail,
    }));
  } catch {
    findings = [];
  }
  const risk: Risk = findings.some((f) => f.level === "danger")
    ? "danger"
    : findings.some((f) => f.level === "caution")
      ? "caution"
      : "none";
  return { risk, findings };
}
