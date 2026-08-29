import { describe, expect, test } from "bun:test";
import type { ResourceBrowseEntry } from "@pstdio/workbench";
import { buildResourceParamOptions } from "./resource-param-options";

describe("resource param options", () => {
  test("lists the requested resource type with extension resource values", () => {
    const entries: ResourceBrowseEntry[] = [
      {
        resource: {
          kind: "workspace",
          uri: "pstdio://workspace/workspace-1",
          id: "workspace-1",
          label: "PS-324_A1",
          metadata: { projectId: "project-1" },
        },
        description: "bugfix/ps-324",
      },
      {
        resource: { kind: "project", uri: "pstdio://project/project-1", id: "project-1", label: "Prompt Studio" },
      },
    ];

    const options = buildResourceParamOptions(entries, "workspace");

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ id: "pstdio://workspace/workspace-1", name: "PS-324_A1" });
    expect(JSON.parse(options[0]!.value)).toEqual({
      type: "workspace",
      id: "workspace-1",
      label: "PS-324_A1",
      metadata: { projectId: "project-1" },
    });
  });
});
