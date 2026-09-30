import { describe, expect, test } from "bun:test";
import { params } from "./params";

describe("extension params", () => {
  test("keeps static selection descriptors editable after construction", () => {
    const select = params.select({ options: [{ label: "A", value: "a" }] });
    select.label = "Selection";
    select.options.push({ label: "B", value: "b" });
    const multiSelect = params.multiSelect({ options: [] });
    multiSelect.required = true;
    multiSelect.options.push({ label: "C", value: "c" });
    expect(select.options.map((option) => option.value)).toEqual(["a", "b"]);
    expect(multiSelect).toMatchObject({ required: true, options: [{ label: "C", value: "c" }] });
  });

  test("builds template selectors with their template type", () => {
    expect(params.template({ label: "Template", type: "ticket", required: true })).toEqual({
      type: "template",
      templateType: "ticket",
      label: "Template",
      required: true,
    });
  });
});
