import { Box, SimpleGrid, Text } from "@chakra-ui/react";
import type { PageRef, ResourceRef as PageResourceRef } from "@pstdio/sdk/extensions";
import type { ResourceBrowseEntry, ResourceRef, WorkbenchCore } from "@pstdio/workbench";
import { text } from "pstdio-extensions/workbench";
import type { ExtensionBenchLoadResponse } from "../lib/api-contract";
import { isPageForResourceKind, resourceKindsFromMetadata } from "../lib/resource-bindings";
import { contentContributionWidgetId } from "./content-contribution-panel";

const previewModeId = "extension-testbench";
const previewOwnerId = "pstdio.extension-testbench";
const primaryViewId = "extension-testbench.primary-view";

const PrimaryPanel = (props: { bench: ExtensionBenchLoadResponse; resource?: ResourceRef }) => {
  const { bench, resource } = props;
  const extension = bench.metadata.extensions[0];
  const details = [
    ["Extension", extension?.displayName ?? extension?.name ?? "Unknown"],
    ["Source", bench.sourcePath],
    ["Views", String(bench.summary.views)],
    ["Tree views", String(bench.summary.treeViews)],
    ["Templates", String(bench.summary.templates)],
    ["Skills", String(bench.summary.skills)],
  ];

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
        {details.map(([label, value]) => (
          <Box key={label} bg="bg" borderColor="border.subtle" borderRadius="sm" borderWidth="1px" minW="0" p="3">
            <Text as="dt" color="fg.muted" fontSize="xs" fontWeight="700" mb="1">
              {label}
            </Text>
            <Text as="dd" fontSize="sm" m="0" overflowWrap="anywhere">
              {value}
            </Text>
          </Box>
        ))}
      </SimpleGrid>
    </Box>
  );
};

const toPageResource = (resource: ResourceRef): PageResourceRef => ({
  type: resource.kind,
  id: resource.id ?? resource.uri,
  label: resource.label,
  metadata: resource.metadata as PageResourceRef["metadata"],
});

const previewPageRef = (id: string): PageRef => ({ extensionId: previewOwnerId, kind: "page", id });
const viewPreviewPageRef = (localId: string) => previewPageRef(`view.${localId}`);
const contentPreviewPageRef = (kind: string, id: string) => previewPageRef(`${kind}.${id}`);

const navigate = (workbench: WorkbenchCore, projectId: string, page: PageRef, resource?: ResourceRef) => {
  workbench.pageLocations.setProject(projectId);
  return workbench.navigation.openTarget({
    kind: "page",
    page,
    ...(resource ? { resource: toPageResource(resource) } : {}),
  });
};

export const navigateExtensionPage = (
  workbench: WorkbenchCore,
  bench: ExtensionBenchLoadResponse,
  page: ExtensionBenchLoadResponse["metadata"]["pages"][number],
  resource?: ResourceRef,
) =>
  navigate(
    workbench,
    bench.projectId,
    { extensionId: page.extensionId, kind: "page", id: page.localId },
    resource && isPageForResourceKind(bench.metadata, page.localId, resource.kind) ? resource : undefined,
  );

export const navigateViewPreview = (
  workbench: WorkbenchCore,
  bench: ExtensionBenchLoadResponse,
  localId: string,
  resource?: ResourceRef,
) => navigate(workbench, bench.projectId, viewPreviewPageRef(resource ? `${localId}.resource` : localId), resource);

export const navigateContentPreview = (
  workbench: WorkbenchCore,
  bench: ExtensionBenchLoadResponse,
  kind: string,
  id: string,
) => navigate(workbench, bench.projectId, contentPreviewPageRef(kind, id));

export const navigateResourcePreview = (
  workbench: WorkbenchCore,
  bench: ExtensionBenchLoadResponse,
  resource: ResourceRef,
) => {
  const page = bench.metadata.pages.find((candidate) =>
    isPageForResourceKind(bench.metadata, candidate.localId, resource.kind),
  );
  return page
    ? navigateExtensionPage(workbench, bench, page, resource)
    : navigate(workbench, bench.projectId, previewPageRef("overview.resource"), resource);
};

export const registerResourceKinds = (
  workbench: WorkbenchCore,
  bench: ExtensionBenchLoadResponse,
  resource: ResourceRef,
) => {
  const kinds = new Set([resource.kind, ...resourceKindsFromMetadata(bench.metadata)]);
  for (const kind of kinds) {
    if (!workbench.resources.getKind(kind)) {
      workbench.resources.registerKind({ kind, label: kind, icon: "FileText" });
    }
  }
};

const registerPage = (
  workbench: WorkbenchCore,
  input: { id: string; path: string; ref: PageRef; title: string; viewId: string; resourceKind?: string },
) => {
  workbench.pages.registerPage({
    id: input.id,
    ref: input.ref,
    title: input.title,
    path: input.path,
    modeId: previewModeId,
    slots: [{ id: "content", role: "primary", region: "main", viewId: input.viewId }],
  });
  if (!input.resourceKind) return;
  workbench.pages.registerPage({
    id: `${input.id}.resource`,
    ref: { ...input.ref, id: `${input.ref.id}.resource` },
    title: input.title,
    path: `${input.path}/resource`,
    modeId: previewModeId,
    parentId: input.id,
    slots: [
      {
        id: "content",
        role: "primary",
        region: "main",
        binding: { resourceKinds: [input.resourceKind], viewId: input.viewId, cardinality: "one" },
      },
    ],
  });
};

export const registerPreviewPages = (
  workbench: WorkbenchCore,
  bench: ExtensionBenchLoadResponse,
  resource: ResourceRef,
) => {
  if (!workbench.modes.getMode(previewModeId)) {
    workbench.modes.registerMode({ id: previewModeId, label: "Extension testbench", activate: () => undefined });
  }

  workbench.views.registerView({
    id: primaryViewId,
    title: "Preview",
    body: {
      kind: "react",
      render: ({ instance }) => <PrimaryPanel bench={bench} resource={instance.resource} />,
    },
  });
  registerPage(workbench, {
    id: "extension-testbench.page.overview",
    path: "preview",
    ref: previewPageRef("overview"),
    title: "Preview",
    viewId: primaryViewId,
    resourceKind: resource.kind,
  });

  for (const view of bench.metadata.views) {
    registerPage(workbench, {
      id: `extension-testbench.page.view.${view.localId}`,
      path: `preview/view/${view.localId}`,
      ref: viewPreviewPageRef(view.localId),
      title: text(view.title, view.id),
      viewId: view.id,
      resourceKind: resource.kind,
    });
  }

  const content = [
    ...bench.inventory.templates.map((entry) => ({ kind: "template" as const, entry })),
    ...bench.inventory.skills.map((entry) => ({ kind: "skill" as const, entry })),
    ...bench.inventory.themes.map((entry) => ({ kind: "theme" as const, entry })),
    ...bench.inventory.fileIconThemes.map((entry) => ({ kind: "fileIconTheme" as const, entry })),
  ];
  for (const { kind, entry } of content) {
    const viewId = contentContributionWidgetId(kind, entry.id);
    registerPage(workbench, {
      id: `extension-testbench.page.${kind}.${entry.id}`,
      path: `preview/${kind}/${entry.id}`,
      ref: contentPreviewPageRef(kind, entry.id),
      title: text(entry.title, entry.id),
      viewId,
    });
  }
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
    if (!workbench.resources.getKind(entry.resource.kind)) {
      workbench.resources.registerKind({
        kind: entry.resource.kind,
        label: entry.resource.kind,
        icon: entry.resource.icon ?? "FileText",
      });
    }
  }
  workbench.resources.registerProvider({
    id: "extension-testbench.resources",
    kind: "extension-testbench",
    list: (query) =>
      bench.resources
        .filter((entry) => matchesResourceQuery(entry, query))
        .map((entry) => ({
          ...entry,
          activate: () => navigateResourcePreview(workbench, bench, entry.resource),
        })),
  });
};
