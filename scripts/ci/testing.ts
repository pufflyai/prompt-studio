export { createStackApi, inParallel, type StackApi } from "../dev/large-project-api";
export { writeLargeProjectFiles } from "../dev/large-project-files";
export { importedSessionId, writeSessionExport } from "../dev/large-project-sessions";
export * from "./browser-smoke-selection";
export { describeProductionPayload } from "./production-payload";
export * from "./test-file-shards";
export * from "./test-fixture-profiles";
export * from "./test-quarantine";

// 0.49 rebuilds the local database. Later releases keep the ordinary upgrade budget.
export const local049UpgradeLimitMs = 40_000;
export const projectUpgradeLimitMs = (candidateVersion: string) =>
  candidateVersion.startsWith("0.49.") ? local049UpgradeLimitMs : 20_000;
