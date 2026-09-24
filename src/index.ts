// guardhook — public API.
export { classifyCommand } from "./engine.js";
export { gate } from "./tiers.js";
export type { Gate } from "./tiers.js";
export type { Risk, Finding, Classification } from "./engine.js";
export { decide, toHookOutput, runHook } from "./hook.js";
export type { HookInput, Decision, Behavior, Options } from "./hook.js";
export { scanSecrets, isSensitivePath } from "./secrets.js";
export { runInit, mergeSettings, hookCommand, settingsPath } from "./init.js";
export { loadConfig, fromRaw, EMPTY_CONFIG } from "./config.js";
export type { Config, RawConfig } from "./config.js";
