import { describe, expect, test } from "bun:test";
import type { ProjectTemplateAsset } from "@/shared/projects/project-types";
import { buildTemplateParamOptions } from "./template-param-options";

const template = (input: {
  name: string;
  title: string;
  templateType: ProjectTemplateAsset["templateType"];
  enabled?: boolean;
}): ProjectTemplateAsset => ({
  id: input.name,
  projectId: "project-1",
  name: input.name,
  title: input.title,
  templateType: input.templateType,
  sourceKind: "project",
  content: "",
  isDefault: false,
  enabled: input.enabled,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("template param options", () => {
  test("lists enabled templates matching the requested template type", () => {
    const options = buildTemplateParamOptions(
      [
        template({ name: "ticket", title: "Ticket", templateType: "ticket" }),
        template({ name: "prd", title: "PRD", templateType: "document" }),
        template({ name: "disabled-ticket", title: "Disabled ticket", templateType: "ticket", enabled: false }),
      ],
      { templateType: "ticket" },
    );

    expect(options.map((option) => option.value)).toEqual(["ticket"]);
    expect(options.find((option) => option.value === "ticket")?.label).toBe("Ticket");
  });
});
