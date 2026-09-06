import { Stack, Text } from "@chakra-ui/react";
import type { PageRef } from "@pstdio/sdk/extensions";
import { createWorkbench, type WorkbenchCore } from "@pstdio/workbench";

const navigationPages = [
  { id: "search", title: "Search", icon: "Search" },
  { id: "sessions", title: "Sessions", icon: "MessagesSquare" },
  { id: "tickets", title: "Tickets", icon: "Ticket" },
  { id: "settings", title: "Settings", icon: "Settings" },
] as const;
const pageRef = (id: string): PageRef => ({ extensionId: "host", kind: "page", id });
const pageTarget = (id: string) => ({ kind: "page" as const, page: pageRef(id) });
const registerNavigationPage = (workbench: WorkbenchCore, page: (typeof navigationPages)[number]) => {
  const contributionId = `host.project-navigation.${page.id}`;
  workbench.views.registerView({
    id: contributionId,
    title: page.title,
    body: {
      kind: "react",
      render: () => (
        <Stack h="full" gap="sm" p="lg" bg="bg">
          <Text textStyle="heading/M/semibold">{page.title}</Text>
          <Text color="fg.muted">This page was opened by the tree renderer.</Text>
        </Stack>
      ),
    },
  });
  workbench.pages.registerPage({
    id: contributionId,
    ref: pageRef(page.id),
    title: page.title,
    path: page.id,
    modeId: "project",
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: contributionId,
      },
      cardinality: "one",
    },
    slots: [],
  });
};
export const createTreeWorkbench = () => {
  const workbench = createWorkbench({ startPage: pageRef("search") });
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  for (const page of navigationPages) registerNavigationPage(workbench, page);
  workbench.views.registerView({
    id: "host.project-navigation",
    title: "Project navigation",
    body: {
      kind: "tree",
      defaultExpandedSectionIds: ["project"],
      getHeader: () => [
        {
          id: "search",
          nodes: [
            {
              id: "search",
              label: "Search",
              icon: "Search",
              target: pageTarget("search"),
            },
          ],
        },
      ],
      getBody: () => [
        {
          id: "project",
          label: "Project",
          nodes: [
            {
              id: "sessions",
              label: "Sessions",
              icon: "MessagesSquare",
              target: pageTarget("sessions"),
            },
            {
              id: "tickets",
              label: "Tickets",
              icon: "Ticket",
              target: pageTarget("tickets"),
            },
          ],
        },
      ],
      getFooter: () => [
        {
          id: "account",
          nodes: [
            {
              id: "settings",
              label: "Settings",
              icon: "Settings",
              target: pageTarget("settings"),
            },
          ],
        },
      ],
      getChildren: () => [],
    },
  });
  workbench.modePlacements.registerPlacement({
    id: "host.project-navigation",
    ref: { extensionId: "host", kind: "placement", id: "project-navigation" },
    modeId: "project",
    item: {
      kind: "view",
      presence: "fixed",
      view: {
        kind: "view",
        id: "host.project-navigation",
      },
    },
    region: "sidenav",
    movableTo: ["sidenav"],
  });
  workbench.pageLocations.switchProject("storybook");
  return workbench;
};
