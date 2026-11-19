import { beforeAll } from "bun:test";
import { buildBinary } from "./packaged-helpers";
import { registerPerformanceSmokeTests } from "./packaged-performance-smoke";

beforeAll(buildBinary);
registerPerformanceSmokeTests();
