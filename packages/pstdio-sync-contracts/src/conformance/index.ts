// Test-only entry point. Never imported by the runtime-neutral wire entry point.

export { createCoveredFixture } from "./covered-fixture";
export { visible as readConformanceRecord } from "./documents";
export { createObjects as createConformanceObjects } from "./objects";
export type { ConformanceCase, ConformanceFactory } from "./reference";
export { createReferenceFixture } from "./reference";
export { createConformanceServices } from "./services";
export { registerConformance } from "./suite";
