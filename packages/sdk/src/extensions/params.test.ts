import { describe, expect, test } from "bun:test";
import { params } from "./params";

describe("extension params", () => {
  test("builds template selectors with their template type", () => {
    expect(params.template({ label: "Template", type: "ticket", required: true })).toEqual({
      type: "template",
      templateType: "ticket",
      label: "Template",
      required: true,
    });
  });
});
