import { describe, expect, test } from "bun:test";
import extension from "./extension";

describe("pstdio-reports extension", () => {
  test("registers historical report commands and templates", () => {
    expect(extension.commands?.map((command) => command.id).sort()).toEqual([
      "reports.delete",
      "reports.export",
      "reports.read",
      "reports.redirect",
      "reports.save",
      "reports.write",
      "templates.delete",
      "templates.list",
      "templates.read",
      "templates.save",
    ]);
    expect(extension.templateTypes?.find((templateType) => templateType.id === "report")).toMatchObject({
      label: "Report",
    });
    expect(extension.templates?.find((template) => template.id === "review")).toMatchObject({
      type: "report",
      title: "Review",
    });
    expect(extension.templates?.find((template) => template.id === "change-request")).toMatchObject({
      type: "report",
      title: "Change request",
    });
  });
});
