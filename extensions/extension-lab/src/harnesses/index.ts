import { defineHarness } from "@pstdio/sdk/extensions";
import { createFakeHarness } from "./fake-harness";

export const labHarnesses = [defineHarness(createFakeHarness())];
