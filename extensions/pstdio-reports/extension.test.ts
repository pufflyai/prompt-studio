import { describe, expect, test } from "bun:test";
import extension from "./extension";

describe("pstdio-reports extension", () => {
  test("registers reports commands, template, and skill", () => {
    expect(extension.commands?.map((command) => command.id).sort()).toEqual([
      "reports.delete",
      "reports.read",
      "reports.save",
      "reports.write",
    ]);
    expect(extension.templateTypes?.find((templateType) => templateType.id === "report")).toMatchObject({
      label: "Report",
    });
    expect(extension.templates?.find((template) => template.id === "review")).toMatchObject({
      type: "report",
      title: "Review",
    });
    expect(extension.templates?.find((template) => template.id === "change_request")).toMatchObject({
      type: "report",
      title: "Change request",
    });
    expect(extension.skills?.find((skill) => skill.id === "use_reports")).toMatchObject({ title: "Use reports" });
  });
});
