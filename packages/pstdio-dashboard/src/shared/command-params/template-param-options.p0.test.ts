import { describe, expect, test } from "bun:test";
import type { ProjectTemplateAsset } from "@/modules/settings/data/template-provider-api";
import { buildTemplateParamOptions } from "./template-param-options";

const template = (input: Pick<ProjectTemplateAsset, "name" | "title" | "templateType" | "localType">) => ({
  ...input,
  id: `${input.templateType}:${input.name}`,
  projectId: "project-1",
  groupLabel: "Templates",
  groupOrder: 0,
  commands: { list: "list", read: "read", save: "save", delete: "delete" },
});

describe("template param options", () => {
  test("lists templates from the requested extension-owned type", () => {
    const options = buildTemplateParamOptions(
      [
        template({
          name: "bug-fix",
          title: "Bug fix",
          templateType: "pstdio.pstdio-planner.template-type.ticket",
          localType: "ticket",
        }),
        template({
          name: "review",
          title: "Review",
          templateType: "pstdio.pstdio-reports.template-type.report",
          localType: "report",
        }),
      ],
      { templateType: "pstdio.pstdio-planner.template-type.ticket" },
    );

    expect(options).toEqual([{ label: "Bug fix", value: "bug-fix" }]);
  });
});
