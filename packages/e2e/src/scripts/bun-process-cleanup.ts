import { afterAll, afterEach } from "bun:test";
import { stopPendingTestProcesses } from "./pending-test-processes";

afterEach(stopPendingTestProcesses);
afterAll(stopPendingTestProcesses);
