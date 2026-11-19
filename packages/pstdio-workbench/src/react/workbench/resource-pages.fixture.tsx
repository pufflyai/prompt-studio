import { Box, Input, Text } from "@chakra-ui/react";
import type { ResourceRef } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { createWorkbench } from "../../core";

let nextMount = 0;
const ResourceEditor = (props: { resource?: ResourceRef }) => {
  const [draft, setDraft] = useState("");
  const [mount] = useState(() => ++nextMount);
  const label = props.resource?.id ?? "composer";
  return (
    <Box p="md" data-resource-editor={label} data-editor-mount={mount}>
      <Text>{props.resource?.label ?? "New draft"}</Text>
      <Input aria-label={`Draft for ${label}`} value={draft} onChange={(event) => setDraft(event.target.value)} />
    </Box>
  );
};

export const createResourcePagesWorkbench = () => {
  const page = (id: string) => ({ kind: "page" as const, extensionId: "preview.pages", id });
  const workbench = createWorkbench({ defaultPage: page("home"), initialSidePanelMode: "attached" });
  workbench.modes.registerMode({ id: "project", activate() {} });
  workbench.views.registerView({
    id: "editor",
    title: "Editor",
    body: { kind: "react", render: ({ instance }) => <ResourceEditor resource={instance.resource} /> },
  });
  workbench.views.registerView({
    id: "companion",
    title: "Companion",
    body: { kind: "react", render: () => <Text p="md">Companion content</Text> },
  });
  workbench.views.registerView({
    id: "home",
    title: "Home",
    body: { kind: "react", render: () => <Text p="md">Home content</Text> },
  });
  workbench.views.registerView({
    id: "properties",
    title: "Properties",
    body: { kind: "react", render: ({ instance }) => <Text p="md">Properties for {instance.resource?.id}</Text> },
  });
  workbench.viewMenus.registerViewMenu({
    id: "properties",
    ownerViewId: "editor",
    viewId: "properties",
    side: "right",
  });
  workbench.pages.registerPage({
    id: "home",
    ref: page("home"),
    title: "Home",
    path: "home",
    modeId: "project",
    main: { kind: "view", view: { kind: "view", id: "home" }, cardinality: "one", presentation: "page" },
    slots: [],
  });
  workbench.pages.registerPage({
    id: "tabs",
    ref: page("tabs"),
    title: "Collection",
    path: "tabs",
    modeId: "project",
    main: { kind: "panels" },
    slots: [
      {
        id: "collection",
        region: "main",
        item: { kind: "view", view: { kind: "view", id: "companion" }, presence: "open" },
      },
    ],
  });
  workbench.pages.registerPage({
    id: "record",
    ref: page("record"),
    title: "Record",
    path: "record",
    modeId: "project",
    parentId: "home",
    resource: { kinds: [{ kind: "resource-kind", id: "record" }] },
    main: {
      kind: "view",
      presentation: "page",
      view: { kind: "view", id: "editor" },
      cardinality: "many",
      mountStrategy: "keep-mounted",
    },
    slots: [],
  });
  workbench.modePlacements.registerPlacement({
    id: "companion",
    ref: { kind: "placement", extensionId: "preview.pages", id: "companion" },
    modeId: "project",
    region: "side",
    item: { kind: "view", view: { kind: "view", id: "companion" }, presence: "open" },
  });
  workbench.pageLocations.setProject("preview");
  const open = (id: string) =>
    workbench.navigation.openTarget({
      kind: "page",
      page: page("record"),
      resource: { type: "record", id, label: `Resource ${id}` },
      open: "pin",
    });
  workbench.pageLocations.navigate({
    kind: "page",
    page: page("record"),
    resource: { type: "record", id: "A", label: "Resource A" },
    open: "pin",
  });
  return {
    workbench,
    open,
    home: () => workbench.pageLocations.navigate({ kind: "page", page: page("home") }),
    tabs: () => workbench.pageLocations.navigate({ kind: "page", page: page("tabs") }),
  };
};
