import { Box, SimpleGrid, Text } from "@chakra-ui/react";
import type { ResourceBrowseEntry, ResourceRef, WorkbenchCore } from "@pstdio/workbench";
import { text } from "pstdio-extensions/workbench";
import type { ExtensionBenchLoadResponse } from "../lib/api-contract";
import { isPanelForResourceKind, resourceKindsFromMetadata } from "../lib/resource-bindings";

const primaryRendererId = "extension-testbench.primary.renderer";
const primaryWidgetId = "extension-testbench.primary";
const syntheticTreeWidgetId = "extension-testbench.tree";

const PrimaryPanel = (props: { bench: ExtensionBenchLoadResponse; resource?: ResourceRef }) => {
  const { bench, resource } = props;
  const extension = bench.metadata.extensions[0];

  return (
    <Box as="section" alignContent="start" display="grid" gap="4" h="full" minH="0" overflow="auto" p="6">
      <Box>
        <Text color="fg.muted" fontSize="xs" fontWeight="700" mb="1" textTransform="uppercase">
          {resource?.kind ?? "resource"}
        </Text>
        <Text as="h1" fontSize="2xl" fontWeight="600" lineHeight="1.2">
          {resource?.label ?? "Preview resource"}
        </Text>
      </Box>
      <SimpleGrid as="dl" columns={{ base: 1, md: 2 }} gap="2" m="0" maxW="760px">
        <Box bg="bg" borderColor="border.subtle" borderRadius="sm" borderWidth="1px" minW="0" p="3">
          <Text as="dt" color="fg.muted" fontSize="xs" fontWeight="700" mb="1">
            Extension
          </Text>
          <Text as="dd" fontSize="sm" m="0" overflowWrap="anywhere">
            {extension?.displayName ?? extension?.name ?? "Unknown"}
          </Text>
        </Box>
        <Box bg="bg" borderColor="border.subtle" borderRadius="sm" borderWidth="1px" minW="0" p="3">
          <Text as="dt" color="fg.muted" fontSize="xs" fontWeight="700" mb="1">
            Source
          </Text>
          <Text as="dd" fontSize="sm" m="0" overflowWrap="anywhere">
            {bench.sourcePath}
          </Text>
        </Box>
        <Box bg="bg" borderColor="border.subtle" borderRadius="sm" borderWidth="1px" minW="0" p="3">
          <Text as="dt" color="fg.muted" fontSize="xs" fontWeight="700" mb="1">
            Views
          </Text>
          <Text as="dd" fontSize="sm" m="0">
            {bench.summary.panels}
          </Text>
        </Box>
        <Box bg="bg" borderColor="border.subtle" borderRadius="sm" borderWidth="1px" minW="0" p="3">
          <Text as="dt" color="fg.muted" fontSize="xs" fontWeight="700" mb="1">
            Tree renderers
          </Text>
          <Text as="dd" fontSize="sm" m="0">
            {bench.summary.treeRenderers}
          </Text>
        </Box>
        <Box bg="bg" borderColor="border.subtle" borderRadius="sm" borderWidth="1px" minW="0" p="3">
          <Text as="dt" color="fg.muted" fontSize="xs" fontWeight="700" mb="1">
            Templates
          </Text>
          <Text as="dd" fontSize="sm" m="0">
            {bench.summary.templates}
          </Text>
        </Box>
        <Box bg="bg" borderColor="border.subtle" borderRadius="sm" borderWidth="1px" minW="0" p="3">
          <Text as="dt" color="fg.muted" fontSize="xs" fontWeight="700" mb="1">
            Skills
          </Text>
          <Text as="dd" fontSize="sm" m="0">
            {bench.summary.skills}
          </Text>
        </Box>
      </SimpleGrid>
    </Box>
  );
};

const findTreeView = (bench: ExtensionBenchLoadResponse, resource: ResourceRef) =>
  bench.metadata.panels.find(
    (view) => view.renderer?.kind === "tree" && isPanelForResourceKind(bench.metadata, view.id, resource.kind),
  ) ?? bench.metadata.panels.find((view) => view.renderer?.kind === "tree");

export const registerResourceKinds = (
  workbench: WorkbenchCore,
  bench: ExtensionBenchLoadResponse,
  resource: ResourceRef,
) => {
  const kinds = new Set([resource.kind, ...resourceKindsFromMetadata(bench.metadata)]);

  for (const kind of kinds) {
    if (workbench.resources.getKind(kind)) continue;
    workbench.resources.registerKind({
      kind,
      label: kind,
      icon: "FileText",
      surface: kind === resource.kind ? "primary" : undefined,
    });
  }
};

export const openPrimaryResource = (
  workbench: WorkbenchCore,
  resource: ResourceRef,
  bench: ExtensionBenchLoadResponse,
) => {
  workbench.renderers.registerRenderer({
    id: primaryRendererId,
    render: ({ instance }) => <PrimaryPanel bench={bench} resource={instance.resource} />,
  });
  workbench.layout.registerPanel({
    closable: true,
    id: primaryWidgetId,
    title: "Preview",
    region: "main",
    rendererId: primaryRendererId,
    singleton: false,
  });
  workbench.resources.registerPresenter({
    id: "extension-testbench.resource-presenter",
    canOpen: (candidate) => candidate.kind === resource.kind,
    open: (candidate) =>
      workbench.layout.openPanel(primaryWidgetId, {
        resource: candidate,
        title: candidate.label ?? candidate.id ?? candidate.uri,
      }),
  });
  workbench.layout.openPanel(primaryWidgetId, { pinned: true, resource, title: resource.label });
};

export const openTreePreview = (workbench: WorkbenchCore, bench: ExtensionBenchLoadResponse, resource: ResourceRef) => {
  const view = findTreeView(bench, resource);

  if (view) {
    workbench.layout.openPanel(view.id, {
      pinned: true,
      resource,
      title: text(view.title, view.id),
    });
    return;
  }

  const renderer = bench.metadata.treeRenderers?.[0];
  if (!renderer) return;

  workbench.layout.registerPanel({
    closable: false,
    id: syntheticTreeWidgetId,
    title: text(renderer.title, renderer.id),
    region: "main-left-menu",
    rendererId: renderer.id,
    resourceKinds: [resource.kind],
  });
  workbench.layout.openPanel(syntheticTreeWidgetId, {
    pinned: true,
    resource,
    title: text(renderer.title, renderer.id),
  });
};

const matchesResourceQuery = (entry: ResourceBrowseEntry, query: string) => {
  const value = query.trim().toLowerCase();
  if (!value) return true;
  return [entry.resource.label, entry.resource.id, entry.resource.uri, entry.searchText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(value);
};

export const registerPreviewResourceProvider = (workbench: WorkbenchCore, bench: ExtensionBenchLoadResponse) => {
  if (bench.resources.length === 0) return;

  for (const entry of bench.resources) {
    if (workbench.resources.getKind(entry.resource.kind)) continue;
    workbench.resources.registerKind({
      kind: entry.resource.kind,
      label: entry.resource.kind,
      icon: entry.resource.icon ?? "FileText",
      surface: "primary",
    });
  }

  workbench.resources.registerProvider({
    id: "extension-testbench.resources",
    kind: "extension-testbench",
    list: (query) => bench.resources.filter((entry) => matchesResourceQuery(entry, query)),
  });
};
