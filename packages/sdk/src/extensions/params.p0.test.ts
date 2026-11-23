import { describe, expect, test } from "bun:test";
import { l10n } from "./index";
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
    expect(select.options[0]?.label.toUpperCase()).toBe("A");
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

  test("retains localized labels on static parameter choices", () => {
    const label = l10n("run-tests", "Run tests");
    const single = params.select({ options: [{ value: "tests", label: "Run tests", localizedLabel: label }] });
    const multiple = params.multiSelect({ options: [{ value: "tests", label: "Run tests", localizedLabel: label }] });
    expect(single.options[0]?.localizedLabel).toEqual(label);
    expect(multiple.options[0]?.localizedLabel).toEqual(label);
  });
});
