import { describe, expect, test } from "bun:test";
import extension from "./extension";

describe("pstdio-reports extension", () => {
  test("registers reports commands, template, and skill", () => {
    expect(Object.keys(extension.commands ?? {}).sort()).toEqual(["reports.delete", "reports.save", "reports.write"]);
    expect(extension.templateTypes?.report).toMatchObject({ label: "Report" });
    expect(extension.templates?.report).toMatchObject({ type: "report", title: "Workspace report" });
    expect(extension.skills?.use_reports).toMatchObject({ title: "Use reports" });
  });
});
