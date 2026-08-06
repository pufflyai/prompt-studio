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
  type RuntimeDescriptor,
  type RuntimeDiscovery,
  type RuntimeOwnerType,
  readRuntimeDescriptor,
  writeRuntimeDescriptor,
} from "./runtime-descriptor";
