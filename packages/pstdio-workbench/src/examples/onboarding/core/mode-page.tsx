import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { PageRef } from "@pstdio/sdk/extensions";
import { createWorkbench, type WorkbenchCore, type WorkbenchPanelRenderInput } from "@pstdio/workbench";

const pageRef = (id: string): PageRef => ({ extensionId: "host", kind: "page", id });
const overviewPage = pageRef("overview");
const ticketsPage = pageRef("tickets");
const sessionPage = pageRef("session");
interface GuidePage {
  id: string;
  ref: PageRef;
  title: string;
  path: string;
  modeId: "project" | "session";
  pageContribution: string;
  pageContributionDetail: string;
  description: string;
  links: readonly {
    label: string;
    page: PageRef;
  }[];
}
const guidePages: readonly GuidePage[] = [
  {
    id: "overview",
    ref: overviewPage,
    title: "Project overview",
    path: "overview",
    modeId: "project",
    pageContribution: "Release summary",
    pageContributionDetail: "Milestone v0.31 · 3 changes ready for review",
    description: "Northstar is preparing v0.31. Eight tickets remain open and three are ready for review.",
    links: [
      { label: "Open Tickets", page: ticketsPage },
      { label: "Open current session", page: sessionPage },
    ],
  },
  {
    id: "tickets",
    ref: ticketsPage,
    title: "Tickets",
    path: "tickets",
    modeId: "project",
    pageContribution: "Ticket filter",
    pageContributionDetail: "Status: In progress · Milestone: v0.31",
    description: "PS-336 cleans up the workbench API. PS-337 makes supplied extension templates editable.",
    links: [
      { label: "Open overview", page: overviewPage },
      { label: "Open current session", page: sessionPage },
    ],
  },
  {
    id: "session",
    ref: sessionPage,
    title: "Current session",
    path: "sessions/current",
    modeId: "session",
    pageContribution: "Session context",
    pageContributionDetail: "Agent: Codex · Task: PS-336 · 7 files changed",
    description: "Session S-104 is implementing the workbench API examples for PS-336.",
    links: [{ label: "Open project overview", page: overviewPage }],
  },
];
const ModePageContent = (props: { input: WorkbenchPanelRenderInput; page: GuidePage }) => {
  const { input, page } = props;
  return (
    <Stack h="full" gap="md" p="lg" bg="bg">
      <Stack gap="xs">
        <Text textStyle="heading/M/semibold">{page.title}</Text>
        <Text color="fg.muted">{page.description}</Text>
      </Stack>
      <Text>
        Mode-owned Sidenav: <strong>{page.modeId === "project" ? "Northstar navigation" : "Session S-104"}</strong>
      </Text>
      <Text>
        Page-owned content: <strong>{page.pageContribution}</strong> in Secondary and this panel in Main
      </Text>
      <HStack gap="sm" flexWrap="wrap">
        {page.links.map((link) => (
          <Button
            key={link.label}
            size="sm"
            onClick={() => input.workbench.pageLocations.navigate({ kind: "page", page: link.page })}
          >
            {link.label}
          </Button>
        ))}
      </HStack>
    </Stack>
  );
};
const registerModeSidenav = (workbench: WorkbenchCore, modeId: GuidePage["modeId"], label: string) => {
  const contributionId = `host.${modeId}.navigation`;
  workbench.views.registerView({
    id: contributionId,
    title: `${label} navigation`,
    body: {
      kind: "tree",
      defaultExpandedSectionIds: [modeId],
      getBody: () => [
        {
          id: modeId,
          label,
          nodes: guidePages
            .filter((page) => page.modeId === modeId)
            .map((page) => ({
              id: page.id,
              label: page.title,
              target: { kind: "page", page: page.ref },
            })),
        },
      ],
      getChildren: () => [],
    },
  });
  workbench.modePlacements.registerPlacement({
    id: contributionId,
    ref: { extensionId: "host", kind: "placement", id: `${modeId}-navigation` },
    modeId,
    item: {
      kind: "view",
      presence: "fixed",
      view: {
        kind: "view",
        id: contributionId,
      },
    },
    region: "sidenav",
    movableTo: ["sidenav"],
  });
};
const registerPage = (workbench: WorkbenchCore, page: GuidePage) => {
  const mainId = `host.${page.id}.main`;
  const sidenavId = `host.${page.id}.sidenav`;
  workbench.views.registerView({
    id: mainId,
    title: page.title,
    body: { kind: "react", render: (input) => <ModePageContent input={input} page={page} /> },
  });
  workbench.views.registerView({
    id: sidenavId,
    title: page.pageContribution,
    body: {
      kind: "react",
      render: () => (
        <Stack gap="xs" p="md" bg="bg">
          <Text textStyle="heading/S/semibold">{page.pageContribution}</Text>
          <Text>{page.pageContributionDetail}</Text>
          <Text color="fg.muted">This section belongs to {page.title}. It changes when the page changes.</Text>
        </Stack>
      ),
    },
  });
  workbench.pages.registerPage({
    id: `host.${page.id}`,
    ref: page.ref,
    title: page.title,
    path: page.path,
    modeId: page.modeId,
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: mainId,
      },
      cardinality: "one",
    },
    slots: [
      {
        id: "tools",
        region: "secondary",
        item: {
          kind: "view",
          view: {
            kind: "view",
            id: sidenavId,
          },
          presence: "open",
        },
      },
    ],
  });
};
export const createModeContributionWorkbench = () => {
  const workbench = createWorkbench({ startPage: overviewPage });
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  workbench.modes.registerMode({ id: "session", label: "Session", activate: () => undefined });
  registerModeSidenav(workbench, "project", "Northstar project");
  registerModeSidenav(workbench, "session", "Session S-104");
  for (const page of guidePages) registerPage(workbench, page);
  workbench.pageLocations.switchProject("storybook");
  return workbench;
};
