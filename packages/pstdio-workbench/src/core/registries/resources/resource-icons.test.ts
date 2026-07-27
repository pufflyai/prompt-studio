import { describe, expect, test } from "bun:test";
import { standardResourceIcons } from "./resource-icons";

describe("standardResourceIcons", () => {
  test("includes the shared kanban renderer icon", () => {
    expect(standardResourceIcons.kanbanRenderer).toBe("table-properties");
  });
});
