import { Badge, Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { PageRef } from "@pstdio/sdk/extensions";
import { createWorkbench, type WorkbenchCore, type WorkbenchPanelRenderInput } from "@pstdio/workbench";
import { Workbench, WorkbenchThemeProvider } from "@pstdio/workbench/react";
import { useState } from "react";

const sessionPage: PageRef = { extensionId: "pstdio.storybook", kind: "page", id: "session" };
const labPage: PageRef = { extensionId: "pstdio.storybook", kind: "page", id: "lab" };

interface PageExample {
  id: string;
  ref: PageRef;
  title: string;
  modeId: "session" | "lab";
  path: string;
  description: string;
  details: readonly string[];
  layout: string;
  sidenav: { title: string; detail: string };
  auxiliary: { region: "side" | "secondary"; title: string; detail: string };
  target: PageRef;
  targetLabel: string;
}

const pages: readonly PageExample[] = [
  {
    id: "session",
    ref: sessionPage,
    title: "Session S-104",
    modeId: "session",
    path: "sessions/S-104",
    description: "Codex is updating the workbench onboarding examples for PS-336.",
    details: ["Task: PS-336", "7 files changed", "Validation: pending"],
    layout: "Main + Sidenav + Side panel",
    sidenav: { title: "Session files", detail: "mode-page.tsx · module.tsx · breadcrumbs.tsx" },
    auxiliary: {
      region: "side",
      title: "Session inspector",
      detail: "Agent output, changed files, and session metadata stay visible at full height.",
    },
    target: labPage,
    targetLabel: "Open Extension Lab",
  },
  {
    id: "lab",
    ref: labPage,
    title: "Extension Lab",
    modeId: "lab",
    path: "extension-lab",
    description: "Inspect the installed Planner extension and its workbench contributions.",
    details: ["Extension: pstdio-planner", "API: 1.0.0-alpha.9", "State: enabled"],
    layout: "Main + Sidenav + Secondary panel",
    sidenav: { title: "Contributions", detail: "2 pages · 4 views · 6 commands" },
    auxiliary: {
      region: "secondary",
      title: "Validation output",
      detail: "Manifest and contribution checks passed in the bottom panel.",
    },
    target: sessionPage,
    targetLabel: "Return to Session S-104",
  },
];

const PageContent = (props: { input: WorkbenchPanelRenderInput; page: PageExample; showNavigation: boolean }) => {
  const { input, page, showNavigation } = props;
  return (
    <Box h="full" p="lg" bg="bg">
      <Stack gap="md" maxW="560px">
        <Stack gap="xs">
          <HStack gap="sm" flexWrap="wrap">
            <Text textStyle="heading/L/semibold">{page.title}</Text>
            <Badge colorPalette="blue">{page.modeId} mode</Badge>
            <Badge colorPalette="gray">{page.layout}</Badge>
          </HStack>
          <Text color="fg.muted" textStyle="paragraph/M/regular">
            {page.description}
          </Text>
        </Stack>
        <Stack gap="xs">
          {page.details.map((detail) => (
            <Text key={detail}>{detail}</Text>
          ))}
        </Stack>
        {showNavigation ? (
          <Button
            alignSelf="flex-start"
            onClick={() => input.workbench.pageLocations.navigate({ kind: "page", page: page.target })}
          >
            {page.targetLabel}
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
};

const AuxiliaryContent = (props: { detail: string; owner: string; title: string }) => {
  const { detail, owner, title } = props;
  return (
    <Stack h="full" gap="xs" p="md" bg="bg">
      <Text textStyle="heading/S/semibold">{title}</Text>
      <Text>{detail}</Text>
      <Text color="fg.muted" textStyle="paragraph/XS/regular">
        Owned by {owner}. It leaves with this page.
      </Text>
    </Stack>
  );
};

const registerPage = (workbench: WorkbenchCore, page: PageExample, showNavigation: boolean) => {
  const mainViewId = `storybook.${page.id}.main`;
  const sidenavViewId = `storybook.${page.id}.sidenav`;
  const auxiliaryViewId = `storybook.${page.id}.${page.auxiliary.region}`;

  workbench.views.registerView({
    id: mainViewId,
    title: page.title,
    body: {
      kind: "react",
      render: (input) => <PageContent input={input} page={page} showNavigation={showNavigation} />,
    },
  });
  workbench.views.registerView({
    id: sidenavViewId,
    title: page.sidenav.title,
    body: {
      kind: "react",
      render: () => <AuxiliaryContent {...page.sidenav} owner={page.title} />,
    },
  });
  workbench.views.registerView({
    id: auxiliaryViewId,
    title: page.auxiliary.title,
    body: {
      kind: "react",
      render: () => <AuxiliaryContent {...page.auxiliary} owner={page.title} />,
    },
  });
  workbench.pages.registerPage({
    id: `storybook.${page.id}`,
    ref: page.ref,
    title: page.title,
    path: page.path,
    modeId: page.modeId,
    slots: [
      { id: "content", role: "primary", region: "main", viewId: mainViewId },
      {
        id: "context",
        role: "auxiliary",
        region: "sidenav",
        viewId: sidenavViewId,
        presence: "fixed",
      },
      {
        id: page.auxiliary.region === "side" ? "inspector" : "output",
        role: "auxiliary",
        region: page.auxiliary.region,
        viewId: auxiliaryViewId,
        presence: "open",
      },
    ],
  });
};

interface PageCompositionWorkbenchOptions {
  projectId?: string;
  showNavigation?: boolean;
  startPage?: PageRef;
}

export const createPageCompositionWorkbench = (options: PageCompositionWorkbenchOptions = {}) => {
  const { projectId = "storybook", showNavigation = true, startPage = sessionPage } = options;
  const workbench = createWorkbench({ startPage });
  workbench.modes.registerMode({ id: "session", label: "Session", activate: () => undefined });
  workbench.modes.registerMode({ id: "lab", label: "Extension Lab", activate: () => undefined });
  for (const page of pages) registerPage(workbench, page, showNavigation);

  workbench.pageLocations.switchProject(projectId);
  return workbench;
};

const WorkbenchExampleFrame = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  return (
    <Box h="420px" minH="360px" borderWidth="1px" borderColor="border.subtle" overflow="hidden">
      <Workbench workbench={workbench} />
    </Box>
  );
};

export const PageCompositionExample = () => {
  const [sessionWorkbench] = useState(() =>
    createPageCompositionWorkbench({
      projectId: "storybook-session-composition",
      showNavigation: false,
      startPage: sessionPage,
    }),
  );
  const [labWorkbench] = useState(() =>
    createPageCompositionWorkbench({
      projectId: "storybook-lab-composition",
      showNavigation: false,
      startPage: labPage,
    }),
  );

  return (
    <WorkbenchThemeProvider>
      <Stack gap="xl">
        <Stack gap="sm">
          <Text textStyle="heading/M/semibold">Session composition: full-height Side panel</Text>
          <WorkbenchExampleFrame workbench={sessionWorkbench} />
        </Stack>
        <Stack gap="sm">
          <Text textStyle="heading/M/semibold">Extension Lab composition: bottom Secondary panel</Text>
          <WorkbenchExampleFrame workbench={labWorkbench} />
        </Stack>
      </Stack>
    </WorkbenchThemeProvider>
  );
};

export const PageReplacementExample = () => {
  const [workbench] = useState(() => createPageCompositionWorkbench());

  return (
    <WorkbenchThemeProvider>
      <WorkbenchExampleFrame workbench={workbench} />
    </WorkbenchThemeProvider>
  );
};
