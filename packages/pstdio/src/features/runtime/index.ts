// Extension webviews run on their own `<extension>.localhost` origins at the runtime port.
export { webviewHostLabel, webviewOriginLabel } from "pstdio-api/extensions/webview-origin";
export {
  observeRuntimeShutdown,
  promoteRuntime,
  type RuntimeShutdownResult,
  readRuntimeActivity,
  requestRuntimeShutdown,
  waitForRuntimeExit,
} from "./runtime-client";
export {
  cleanupRuntimeDescriptor,
  discoverRuntime,
  isRuntimePidAlive,
  parseRuntimeDescriptor,
  promoteRuntimeDescriptor,
  type RuntimeDescriptor,
  type RuntimeDiscovery,
  type RuntimeOwnerType,
  readRuntimeDescriptor,
  writeRuntimeDescriptor,
} from "./runtime-descriptor";
