import { Box, SimpleGrid, Text } from "@chakra-ui/react";
import type { ResourceBrowseEntry, ResourceRef, WorkbenchCore } from "@pstdio/workbench/core";
import { text } from "pstdio-extensions/workbench";
import type { ExtensionBenchLoadResponse } from "../lib/api-contract";

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
            {bench.summary.views}
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
  bench.metadata.views.find((view) => view.treeRendererId && view.resourceKind === resource.kind) ??
  bench.metadata.views.find((view) => view.treeRendererId);

export const registerResourceKinds = (
  workbench: WorkbenchCore,
  bench: ExtensionBenchLoadResponse,
  resource: ResourceRef,
) => {
  const kinds = new Set([resource.kind]);
  for (const view of bench.metadata.views) {
    if (view.resourceKind) kinds.add(view.resourceKind);
  }

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
    render: ({ placement }) => <PrimaryPanel bench={bench} resource={placement.resource} />,
  });
  workbench.layout.registerWidget({
    id: primaryWidgetId,
    title: "Preview",
    region: "main",
    rendererId: primaryRendererId,
    singleton: false,
  });
  workbench.resources.registerOpener({
    id: "extension-testbench.resource-opener",
    canOpen: (candidate) => candidate.kind === resource.kind,
    open: (candidate, input) =>
      workbench.layout.openWidget(primaryWidgetId, {
        replaceActive: input.replaceActive,
        resource: candidate,
        title: candidate.label ?? candidate.id ?? candidate.uri,
      }),
  });
  workbench.layout.openWidget(primaryWidgetId, { pinned: true, resource, title: resource.label });
};

export const openTreePreview = (workbench: WorkbenchCore, bench: ExtensionBenchLoadResponse, resource: ResourceRef) => {
  const view = findTreeView(bench, resource);

  if (view) {
    workbench.layout.openWidget(view.id, {
      pinned: true,
      resource,
      title: text(view.title, view.id),
    });
    return;
  }

  const renderer = bench.metadata.treeRenderers?.[0];
  if (!renderer) return;

  workbench.layout.registerWidget({
    id: syntheticTreeWidgetId,
    title: text(renderer.title, renderer.id),
    region: "main-left-menu",
    rendererId: renderer.id,
    resourceKinds: [resource.kind],
  });
  workbench.layout.openWidget(syntheticTreeWidgetId, {
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
