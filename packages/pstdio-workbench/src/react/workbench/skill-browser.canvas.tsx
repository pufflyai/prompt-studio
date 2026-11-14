import type { CanvasMeta } from "@pstdio/canvas";
import { ScrollArea, TreeList } from "@pstdio/ui";
import { ParamEditor } from "@pstdio/ui/param-editor";
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
      kind: "react",
      render: ({ instance }) => (
        <SkillDetailsPreview workbench={workbench} files={files} resource={instance.resource!} />
      ),
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
  workbench.views.registerView({
    id: "skill-navigation",
    title: "Skills",
    body: {
      kind: "tree",
      getChildren: () => [],
      getBody: () => [
        {
          id: "pstdio-skills",
          label: "Prompt Studio Skills",
          nodes: [{ id: "create-ticket", label: "Create a ticket", target: { kind: "page", page, resource } }],
        },
        { id: "canvas", label: "UI Canvas", nodes: [{ id: "canvas", label: "Work with UI Canvas" }] },
      ],
    },
  });
  workbench.shellPlacements.registerPlacement({
    id: "skill-navigation",
    region: "sidenav",
    item: { kind: "view", presence: "fixed", view: { kind: "view", id: "skill-navigation" } },
  });
  workbench.pageLocations.switchProject("skill-browser-preview");
  workbench.pageLocations.navigate({ kind: "page", page, resource });
  return workbench;
};

const SkillDetailsPreview = (props: {
  workbench: ReturnType<typeof createWorkbench>;
  files: { path: string; content: string }[];
  resource: { type: string; id: string };
}) => {
  const [expanded, setExpanded] = useState(["files"]);
  return (
    <ScrollArea h="full" minH="0">
      <ParamEditor
        readOnly
        fullWidth
        groups={[
          {
            id: "info",
            title: "Info",
            collapsible: true,
            params: [
              { id: "name", name: "Name", type: "readOnly", value: "create-ticket" },
              { id: "version", name: "Version", type: "readOnly", value: "1.2.0" },
              {
                id: "description",
                name: "Description",
                type: "readOnly",
                value: "Create actionable tickets from a request.",
              },
            ],
          },
        ]}
      />
      <TreeList
        sections={[
          {
            id: "files",
            label: "Files",
            nodes: props.files.map((file) => ({
              id: file.path,
              label: file.path,
              onActivate: () =>
                props.workbench.pageLocations.navigate({
                  kind: "page",
                  page: { kind: "page", extensionId: "preview", id: "skill" },
                  resource: props.resource,
                  params: { file: file.path },
                }),
            })),
          },
        ]}
        expandedSectionIds={expanded}
        onToggleSection={(id) => setExpanded((value) => (value.includes(id) ? [] : [id]))}
      />
    </ScrollArea>
  );
};

export default {
  title: "Extensions/Skill Browser/Workbench",
  fullscreen: true,
  description:
    "Skills grouped by extension; parameter Info and Files share the host menu. Filename and menu toggle share the file header.",
} satisfies CanvasMeta;

export const Browser = () => {
  const [workbench] = useState(createBrowser);
  return <WorkbenchStory workbench={workbench} />;
};
