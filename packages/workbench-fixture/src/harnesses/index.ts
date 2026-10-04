import { defineHarness } from "@pstdio/sdk/extensions";
import { createCommandHarness } from "./command-harness";
import { createFakeHarness } from "./fake-harness";

export const labHarnesses = [
  defineHarness(createFakeHarness()),
  defineHarness(createCommandHarness(true)),
  defineHarness(createCommandHarness(false)),
];
