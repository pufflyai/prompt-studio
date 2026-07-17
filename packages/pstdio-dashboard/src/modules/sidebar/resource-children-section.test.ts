import { describe, expect, test } from "bun:test";
import type { ResourceRef } from "@pstdio/workbench/core";
import { createResourceChildrenSections } from "./resource-children-section";

const selected: ResourceRef = {
  kind: "workspace",
  uri: "dashboard-workbench://workspace/workspace-1",
  id: "workspace-1",
  label: "Workspace",
};

describe("createResourceChildrenSections", () => {
  test("returns no section without a selected resource", () => {
    expect(createResourceChildrenSections({ children: [] })).toEqual([]);
  });

  test("returns no section when the selected resource has no children", () => {
    expect(createResourceChildrenSections({ resource: selected, children: [] })).toEqual([]);
  });

  test("maps child resources to an unlabeled tree section", () => {
    const children: ResourceRef[] = [
      {
        kind: "session",
        uri: "dashboard-workbench://session/session-1",
        id: "session-1",
        label: "First session",
        icon: "MessageCircle",
        parent: selected.uri,
      },
      {
        kind: "file",
        uri: "dashboard-workbench://file/readme",
        id: "readme",
        label: "README.md",
        parent: selected.uri,
      },
    ];

    expect(createResourceChildrenSections({ resource: selected, children })).toEqual([
      {
        id: "resource-children",
        resource: selected,
        nodes: [
          {
            id: children[0]?.uri,
            label: "First session",
            icon: "MessageCircle",
            resource: children[0],
          },
          {
            id: children[1]?.uri,
            label: "README.md",
            resource: children[1],
          },
        ],
      },
    ]);
  });
});
