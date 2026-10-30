import { Button, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { createLevelNavigation, createWorkbench } from "../../../core";
import { WorkbenchStory } from "../../../examples/workbench-story";

const createFixture = () => {
  const workbench = createWorkbench();
  const navigation = createLevelNavigation(workbench);
  const pending = Promise.withResolvers<void>();
  const rootRead = Promise.withResolvers<void>();
  let rootReads = 0;
  const page = (id: string) => ({ kind: "page" as const, extensionId: "story", id });
  workbench.modes.registerMode({ id: "project", label: "Project", activate() {} });
  for (const id of ["home", "ticket"]) {
    workbench.views.registerView({
      id,
      title: id,
      body: {
        kind: "react",
        render: () =>
          id === "home" ? (
            <Stack>
              <Button onClick={() => workbench.pageLocations.navigate({ kind: "page", page: page("ticket") })}>
                Open ticket
              </Button>
              <Button onClick={() => rootRead.resolve()}>Finish project read</Button>
            </Stack>
          ) : (
            <Stack>
              <Text>Ticket contents</Text>
              <Button onClick={() => pending.resolve()}>Finish navigation read</Button>
            </Stack>
          ),
      },
    });
    workbench.pages.registerPage({
      id,
      ref: page(id),
      title: id,
      path: id,
      modeId: "project",
      main: { kind: "view", view: { kind: "view", id }, cardinality: "one" },
      slots: [],
    });
  }
  for (const slot of ["header", "footer"] as const) {
    const sections = [{ id: slot, nodes: [{ id: slot, label: slot === "header" ? "Search" : "Help" }] }];
    workbench.navigationTrees.registerContribution({
      id: slot,
      owner: { kind: "mode", extensionId: "pstdio", id: "project" },
      sourceExtensionId: "pstdio",
      declarationIndex: 0,
      slot,
      getStructure: () => sections,
      getSections: () => sections,
    });
  }
  workbench.navigationTrees.registerContribution({
    id: "project-items",
    owner: { kind: "mode", extensionId: "pstdio", id: "project" },
    sourceExtensionId: "pstdio",
    declarationIndex: 0,
    resolveResource: () => undefined,
    getSections: async () => {
      if (rootReads++ > 0 && workbench.pages.store.getState().activePageId === "home") await rootRead.promise;
      return [{ id: "project-items", nodes: ["Home", "Notes", "Tickets"].map((label) => ({ id: label, label })) }];
    },
  });
  workbench.navigationTrees.registerContribution({
    id: "ticket-files",
    owner: { kind: "page", extensionId: "story", id: "ticket" },
    sourceExtensionId: "story",
    declarationIndex: 0,
    getSections: () => [{ id: "files", nodes: [{ id: "notes", label: "notes.md" }] }],
  });
  workbench.views.registerView({
    id: "navigation",
    title: "Navigation",
    body: {
      kind: "tree",
      getReadKey: () => navigation.getReadKey(),
      getStructure: () => navigation.getStructure("content"),
      getHeaderStructure: () => navigation.getStructure("header"),
      getFooterStructure: () => navigation.getStructure("footer"),
      getHeader: async (context) => {
        if (workbench.pages.store.getState().activePageId === "ticket") await pending.promise;
        return navigation.getSections("header", context.signal, context.onProgress);
      },
      getFooter: (context) => navigation.getSections("footer", context.signal, context.onProgress),
      getBody: (context) => navigation.getSections("content", context.signal, context.onProgress),
      getChildren: () => [],
    },
  });
  workbench.shellPlacements.registerPlacement({
    id: "navigation",
    region: "sidenav",
    item: { kind: "view", presence: "fixed", view: { kind: "view", id: "navigation" } },
  });
  workbench.pageLocations.setProject("story");
  workbench.pageLocations.navigate({ kind: "page", page: page("home") });
  return workbench;
};
const ChromeContinuityStory = () => {
  const [workbench] = useState(createFixture);
  return <WorkbenchStory workbench={workbench} />;
};
const meta = {
  title: "pstdio-workbench/Guides/Navigation chrome continuity",
  component: ChromeContinuityStory,
  fullscreen: true,
} satisfies CanvasMeta<typeof ChromeContinuityStory>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const OpenTicket: Story = {
  id: "pstdio-workbench-guides-navigation-chrome-continuity--open-ticket",
};
export const ReturnToProject: Story = {
  id: "pstdio-workbench-guides-navigation-chrome-continuity--return-to-project",
};
