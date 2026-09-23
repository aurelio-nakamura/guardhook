// agent-seatbelt — public API.
export { classifyCommand } from "./engine.js";
export type { Risk, Finding, Classification } from "./engine.js";
export { decide, toHookOutput, runHook } from "./hook.js";
export type { HookInput, Decision, Behavior, Options } from "./hook.js";
export { scanSecrets, isSensitivePath } from "./secrets.js";
export { runInit, mergeSettings, hookCommand, settingsPath } from "./init.js";
