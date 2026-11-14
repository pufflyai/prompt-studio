import type { CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

const createBrowser = () => {
  const page = { kind: "page", extensionId: "preview", id: "skill" } as const;
  const resource = { type: "skill", id: "create-ticket", label: "Create a ticket" };
  const files = [
    { path: "SKILL.md", content: "# Create a ticket\n\nTurn a request into an actionable ticket." },
    { path: "references/examples.md", content: "# Examples\n\nDescribe the problem and expected behavior." },
  ];
  const workbench = createWorkbench({ startPage: page });
  workbench.modes.registerMode({ id: "project", activate() {} });
  workbench.resources.registerKind({ kind: "skill", label: "Skill", icon: "sparkles", extensionId: "preview" });
  workbench.views.registerView({
    id: "skill",
    title: "Skill",
    icon: "sparkles",
    body: {
      kind: "file",
      load: (_resource, _signal, params) => {
        const file = files.find((file) => file.path === params?.file) ?? files[0];
        return { fileName: file.path, filePath: file.path, content: file.content, editable: false };
      },
    },
  });
  workbench.views.registerView({
    id: "details",
    title: "Skill details",
    icon: "info",
    body: {
      kind: "tree",
      defaultExpandedSectionIds: ["info", "files"],
      getBody: ({ pageParams }) => [
        {
          id: "info",
          label: "Info",
          nodes: [
            { id: "name", label: "create-ticket", icon: "sparkles" },
            { id: "version", label: "1.2.0", icon: "tag" },
            {
              id: "description",
              label: "Create actionable tickets",
              tooltip: "Create actionable tickets from a request.",
            },
          ],
        },
        {
          id: "files",
          label: "Files",
          nodes: files.map((file) => ({
            id: file.path,
            label: file.path,
            fileName: file.path,
            selected: file.path === (pageParams?.file ?? "SKILL.md"),
            target: { kind: "page" as const, page, resource, params: { file: file.path } },
          })),
        },
      ],
      getChildren: () => [],
    },
  });
  workbench.viewMenus.registerViewMenu({ id: "details", ownerViewId: "skill", viewId: "details", side: "right" });
  workbench.pages.registerPage({
    id: "skill",
    ref: page,
    title: "Skills",
    path: "skill",
    modeId: "project",
    resource: { kinds: [{ kind: "resource-kind", id: "skill" }] },
    params: { file: { type: "string", default: "SKILL.md" } },
    main: { kind: "view", presentation: "page", view: { kind: "view", id: "skill" }, cardinality: "one" },
    slots: [],
  });
  workbench.pageLocations.switchProject("skill-browser-preview");
  workbench.pageLocations.navigate({ kind: "page", page, resource });
  return workbench;
};

export default {
  title: "Extensions/Skill Browser/Workbench",
  fullscreen: true,
  description: "Actual workbench chrome, native file preview and a host-owned resizable details menu.",
} satisfies CanvasMeta;

export const Browser = () => {
  const [workbench] = useState(createBrowser);
  return <WorkbenchStory workbench={workbench} />;
};
