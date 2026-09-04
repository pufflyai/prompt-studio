import { Box, Button, Code, HStack, Stack, Text } from "@chakra-ui/react";
import { createWorkbench, type ResourceRef, type WorkbenchCore } from "@pstdio/workbench";
import { Workbench, WorkbenchThemeProvider } from "@pstdio/workbench/react";
import { useState } from "react";

const documentPlacementId = "guide.document";
const inspectorPlacementId = "guide.branch-inspector";

const documents = {
  alpha: { kind: "document", uri: "document:alpha", id: "alpha", label: "Alpha.md" },
  beta: { kind: "document", uri: "document:beta", id: "beta", label: "Beta.md" },
  gamma: { kind: "document", uri: "document:gamma", id: "gamma", label: "Gamma.md" },
} as const satisfies Record<string, ResourceRef>;

const branches = {
  main: { kind: "branch", uri: "branch:main", id: "main", label: "main" },
  release: { kind: "branch", uri: "branch:release", id: "release", label: "release/v0.31" },
} as const satisfies Record<string, ResourceRef>;

const openDocument = (workbench: WorkbenchCore, resource: ResourceRef, open: "pin" | "preview") => {
  const identity = workbench.shellPlacements.openPlacement({
    placementId: documentPlacementId,
    resource,
    title: resource.label,
    open,
  });
  return identity;
};

const inspectBranch = (workbench: WorkbenchCore, resource: ResourceRef) => {
  workbench.shellPlacements.openPlacement({
    placementId: inspectorPlacementId,
    resource,
    title: `Inspect ${resource.label}`,
  });
};

const DocumentLauncher = (props: { showCardinalityComparison: boolean; workbench: WorkbenchCore }) => {
  const { showCardinalityComparison, workbench } = props;

  return (
    <Stack gap="md" p="lg">
      <Stack gap="xs">
        <Text textStyle="heading/M">Resource cardinality</Text>
        <Text color="fg.muted">
          One placement replaces its resource. The other keeps a tab for every open document.
        </Text>
      </Stack>
      {showCardinalityComparison ? (
        <Stack gap="sm" borderWidth="1px" borderColor="border.subtle" p="md">
          <HStack gap="sm" flexWrap="wrap">
            <Code>cardinality: "one"</Code>
            <Text color="fg.muted">One inspector tab follows the latest branch.</Text>
          </HStack>
          <HStack gap="sm" flexWrap="wrap">
            <Button size="sm" variant="outline" onClick={() => inspectBranch(workbench, branches.main)}>
              Inspect main
            </Button>
            <Button size="sm" variant="outline" onClick={() => inspectBranch(workbench, branches.release)}>
              Inspect release/v0.31
            </Button>
          </HStack>
        </Stack>
      ) : null}
      <Stack gap="sm" borderWidth="1px" borderColor="border.subtle" p="md">
        <HStack gap="sm" flexWrap="wrap">
          <Code>cardinality: "many"</Code>
          <Text color="fg.muted">Pinned documents stay open. The unpinned preview is reused.</Text>
        </HStack>
        <HStack gap="sm" flexWrap="wrap">
          <Button size="sm" onClick={() => openDocument(workbench, documents.alpha, "preview")}>
            Preview Alpha
          </Button>
          <Button size="sm" onClick={() => openDocument(workbench, documents.beta, "preview")}>
            Preview Beta
          </Button>
          <Button size="sm" onClick={() => openDocument(workbench, documents.gamma, "preview")}>
            Preview Gamma
          </Button>
          <Button size="sm" variant="outline" onClick={() => openDocument(workbench, documents.alpha, "pin")}>
            Pin Alpha
          </Button>
          <Button size="sm" variant="outline" onClick={() => openDocument(workbench, documents.beta, "pin")}>
            Pin Beta
          </Button>
        </HStack>
      </Stack>
    </Stack>
  );
};

export const createResourceTabsWorkbench = (showCardinalityComparison = false) => {
  const workbench = createWorkbench();

  workbench.views.registerView({
    id: "guide.documents",
    title: "Documents",
    body: {
      kind: "react",
      render: ({ workbench }) => (
        <DocumentLauncher workbench={workbench} showCardinalityComparison={showCardinalityComparison} />
      ),
    },
  });
  workbench.shellPlacements.registerPlacement({
    id: "guide.documents",
    item: { kind: "view", viewId: "guide.documents", presence: "fixed" },
    region: "main",
  });
  workbench.views.registerView({
    id: "guide.document-view",
    title: "Document",
    body: {
      kind: "react",
      render: ({ instance }) => (
        <Stack gap="sm" p="lg">
          <Text textStyle="heading/M">{instance.resource?.label}</Text>
          <Text color="fg.muted">{instance.resource?.uri}</Text>
        </Stack>
      ),
    },
  });
  workbench.shellPlacements.registerPlacement({
    id: documentPlacementId,
    item: {
      kind: "resource",
      viewId: "guide.document-view",
      resourceKinds: ["document"],
      cardinality: "many",
    },
    region: "secondary",
  });

  if (showCardinalityComparison) {
    workbench.views.registerView({
      id: "guide.branch-inspector",
      title: "Branch inspector",
      body: {
        kind: "react",
        render: ({ instance }) => (
          <Stack gap="sm" p="lg">
            <Text textStyle="heading/M">{instance.resource?.label}</Text>
            <Text color="fg.muted">This same tab rebinds when you inspect another branch.</Text>
            <Code alignSelf="flex-start">{instance.resource?.uri}</Code>
          </Stack>
        ),
      },
    });
    workbench.shellPlacements.registerPlacement({
      id: inspectorPlacementId,
      item: {
        kind: "resource",
        viewId: "guide.branch-inspector",
        resourceKinds: ["branch"],
        cardinality: "one",
      },
      region: "secondary",
    });
    inspectBranch(workbench, branches.main);
    openDocument(workbench, documents.alpha, "pin");
    openDocument(workbench, documents.beta, "preview");
  }

  return workbench;
};

export const ResourceTabsExample = (props: { showCardinalityComparison?: boolean }) => {
  const { showCardinalityComparison = false } = props;
  const [workbench] = useState(() => createResourceTabsWorkbench(showCardinalityComparison));

  return (
    <WorkbenchThemeProvider>
      <Box h="480px" minH="360px" borderWidth="1px" borderColor="border.subtle" overflow="hidden">
        <Workbench workbench={workbench} />
      </Box>
    </WorkbenchThemeProvider>
  );
};
