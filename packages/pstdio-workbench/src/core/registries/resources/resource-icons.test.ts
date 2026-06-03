import { describe, expect, test } from "bun:test";
import { standardResourceIcons } from "./resource-icons";

describe("standardResourceIcons", () => {
  test("includes the shared data renderer icon", () => {
    expect(standardResourceIcons.dataRenderer).toBe("table-properties");
  });
});
