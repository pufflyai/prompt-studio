import { expect, test } from "bun:test";
import { buildViewInput } from "./view-input";

const fields = [
  {
    id: "tag",
    label: "Tag",
    kind: "enum" as const,
    filterable: true,
    groupable: true,
    sortable: true,
    displayable: true,
    options: [
      { value: "a", label: "Bug" },
      { value: "b", label: "Duplicate" },
      { value: "c", label: "Duplicate" },
    ],
  },
];
test("resolves labels, retains values, and combines repeated filters", () => {
  expect(buildViewInput({ filter: ["tag=Bug", "tag=b"], mode: "list", sort: "tag:desc", show: "tag" }, fields)).toEqual(
    {
      filters: { tag: ["a", "b"] },
      settings: { viewMode: "list", ordering: { attributeId: "tag", direction: "desc" }, displayProperties: ["tag"] },
    },
  );
});
test("rejects ambiguous labels and invalid sorting", () => {
  expect(() => buildViewInput({ filter: ["tag=Duplicate"] }, fields)).toThrow("b, c");
  expect(() => buildViewInput({ sort: "tag:down" }, fields)).toThrow("asc|desc");
});
