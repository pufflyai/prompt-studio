import { test } from "../testing/packaged-fixture";
import { runPauseCase } from "./packaged-performance-pause-case";

// PS-169 diagnostic only: five predeclared independent fixtures, no retry or discarded failure.
// Every trial retains the original assertions and its original Linux 40-second allowance.
for (let trial = 1; trial <= 5; trial++) test(`PS-169 Pause input trial ${trial}`, runPauseCase);
