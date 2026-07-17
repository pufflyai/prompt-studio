import { describe, expect, test } from "bun:test";
import type { ResourceRef } from "@pstdio/workbench/core";
import { dashboardCommandIds } from "@/shared/app/commands";
import { createResourceChildrenSections } from "./resource-children-section";

const selected: ResourceRef = {
  kind: "workspace",
  uri: "dashboard-workbench://workspace/workspace-1",
  id: "workspace-1",
  label: "Workspace",
};

const folder: ResourceRef = {
  kind: "folder",
  uri: "dashboard-workbench://folder/folder-1",
  id: "folder-1",
  label: "Folder",
};

describe("createResourceChildrenSections", () => {
  test("returns no section without a selected resource", () => {
    expect(createResourceChildrenSections({ children: [] })).toEqual([]);
  });

  test("returns no section when the selected resource has no children", () => {
    expect(createResourceChildrenSections({ resource: folder, children: [] })).toEqual([]);
  });

  test("keeps the workspace sessions empty state", () => {
    expect(createResourceChildrenSections({ resource: selected, children: [] })).toEqual([
      {
        id: "resource-children",
        resource: selected,
        nodes: [
          {
            id: "sessions",
            label: "Sessions",
            canHide: true,
            collapsible: true,
            children: [{ id: "sessions-empty", label: "No sessions yet", disabled: true }],
          },
        ],
      },
    ]);
  });

  test("maps child resources to an unlabeled tree section", () => {
    const children: ResourceRef[] = [
      {
        kind: "session",
        uri: "dashboard-workbench://session/session-1",
        id: "session-1",
        label: "First session",
        icon: "MessageCircle",
        parent: folder.uri,
      },
      {
        kind: "file",
        uri: "dashboard-workbench://file/readme",
        id: "readme",
        label: "README.md",
        parent: folder.uri,
      },
    ];

    expect(createResourceChildrenSections({ resource: folder, children })).toEqual([
      {
        id: "resource-children",
        resource: folder,
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

  test("groups workspace sessions and keeps other children as resource nodes", () => {
    const session: ResourceRef = {
      kind: "session",
      uri: "dashboard-workbench://session/session-1",
      id: "session-1",
      label: "Implement hierarchy",
      parent: selected.uri,
      metadata: {
        status: "completed",
        lastActivityAt: "2026-07-17T10:00:00.000Z",
      },
    };

    const file: ResourceRef = {
      kind: "file",
      uri: "dashboard-workbench://file/readme",
      id: "readme",
      label: "README.md",
      parent: selected.uri,
    };
    const sections = createResourceChildrenSections({ resource: selected, children: [session, file] });
    const sessionsGroup = sections[0]?.nodes.find((node) => node.id === "sessions");
    expect(sessionsGroup && "children" in sessionsGroup).toBe(true);
    if (!sessionsGroup || !("children" in sessionsGroup)) throw new Error("Expected a Sessions group");
    const sessionNode = sessionsGroup?.children?.find((node) => node.id === session.uri);

    expect(sessionsGroup).toMatchObject({ label: "Sessions", collapsible: true, canHide: true });
    expect(sessionNode).toMatchObject({
      icon: "CircleCheck",
      iconColor: "fg.success",
      target: {
        kind: "command",
        commandId: dashboardCommandIds.openFloatingSession,
        args: { resource: session },
      },
    });
    expect(sections[0]?.nodes).toContainEqual({
      id: file.uri,
      label: "README.md",
      resource: file,
    });
  });

  test("labels ticket resource children as workspaces", () => {
    const ticket: ResourceRef = {
      kind: "ticket",
      uri: "dashboard-workbench://ticket/ticket-1",
      id: "ticket-1",
      label: "PS-181",
    };
    const workspace: ResourceRef = {
      kind: "workspace",
      uri: "dashboard-workbench://workspace/workspace-1",
      id: "workspace-1",
      label: "PS-181_A1",
      parent: ticket.uri,
    };

    expect(createResourceChildrenSections({ resource: ticket, children: [workspace] })[0]).toMatchObject({
      label: "Workspaces",
    });
  });
});
