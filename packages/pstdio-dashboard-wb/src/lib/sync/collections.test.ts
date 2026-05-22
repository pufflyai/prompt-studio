import { describe, expect, test } from "bun:test";
import { SYNCED_TABLES } from "./collections";

describe("SYNCED_TABLES", () => {
  test("includes extension rows used by dashboard contribution selectors", () => {
    expect(SYNCED_TABLES).toContain("installed_extension_sources");
    expect(SYNCED_TABLES).toContain("extension_instances");
  });
});
