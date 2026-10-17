// Test-only entry point. Never imported by the runtime-neutral wire entry point.

export { visible as readConformanceRecord } from "./documents";
export type { ConformanceCase, ConformanceFactory } from "./reference";
export { createReferenceFixture } from "./reference";
export { createConformanceServices } from "./services";
export { registerConformance } from "./suite";
