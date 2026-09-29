import { expect, test } from "bun:test";
import { cleanBoardView, validateBoardView } from "./view-rules";

const fields = [
  {
    id: "status",
    label: "Status",
    kind: "enum" as const,
    options: [{ value: "todo", label: "To do" }],
    groupable: true,
    filterable: true,
    sortable: true,
    displayable: true,
  },
];
const settings = {
  viewMode: "board" as const,
  columnGrouping: "status",
  rowGrouping: "none",
  ordering: { attributeId: "manual", direction: "asc" as const },
  displayProperties: ["status"],
};
test("cleans removed options and fields using valid board defaults", () => {
  const result = cleanBoardView(
    {
      settings: { ...settings, columnGrouping: "gone", displayProperties: ["gone", "status"] },
      filters: { status: ["todo", "deleted"], missing: ["anything"] },
    },
    fields,
    settings,
  );
  expect(result).toEqual({ settings, filters: { status: ["todo"] } });
});
test("reports valid field IDs and option values for invalid writes", () => {
  expect(() => validateBoardView({ settings, filters: { missing: ["todo"] } }, fields)).toThrow("status");
  expect(() => validateBoardView({ settings, filters: { status: ["deleted"] } }, fields)).toThrow("todo");
  expect(() => validateBoardView({ settings, filters: { status: ["todo"] } }, fields)).not.toThrow();
});
