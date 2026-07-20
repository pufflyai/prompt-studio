import { Box, Button, Code, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type {
  ResourceRef,
  ResourceRegistry,
  TreeNode,
  WorkbenchBreadcrumbItem,
  WorkbenchCore,
  WorkbenchModuleContribution,
} from "../../core";
import { WorkbenchIcon } from "../../react/shared/icon";

const DOCS_KIND = "onboarding.breadcrumb.docs";
const SECTION_KIND = "onboarding.breadcrumb.section";
const PAGE_KIND = "onboarding.breadcrumb.page";

const BREADCRUMB_TREE_ID = "onboarding.breadcrumb.tree";
const DOCS_HOME_WIDGET_ID = "onboarding.breadcrumb.home";
const DOCS_HOME_RENDERER_ID = "onboarding.breadcrumb.home.renderer";
const SECTION_WIDGET_ID = "onboarding.breadcrumb.section";
const SECTION_RENDERER_ID = "onboarding.breadcrumb.section.renderer";
const PAGE_WIDGET_ID = "onboarding.breadcrumb.page";
const PAGE_RENDERER_ID = "onboarding.breadcrumb.page.renderer";

interface OnboardingPage {
  id: string;
  label: string;
  body: string;
}

interface OnboardingSection {
  id: string;
  label: string;
  icon: string;
  description: string;
  pages: OnboardingPage[];
}

const sections: OnboardingSection[] = [
  {
    id: "concepts",
    label: "Concepts",
    icon: "BookOpen",
    description: "The vocabulary the workbench shell is built on.",
    pages: [
      { id: "regions", label: "Regions", body: "Named layout slots widgets pin themselves to." },
      { id: "widgets", label: "Widgets", body: "Registrations that place a renderer into an region." },
    ],
  },
  {
    id: "surfaces",
    label: "Surfaces",
    icon: "PanelsTopLeft",
    description: "Where contributions show up in the running shell.",
    pages: [
      { id: "menus", label: "Menus", body: "Command-backed actions on header and tree paths." },
      { id: "commands", label: "Commands", body: "Executable actions wired to menus and shortcuts." },
    ],
  },
];

const docsResource: ResourceRef = {
  kind: DOCS_KIND,
  uri: `${DOCS_KIND}:root`,
  id: "root",
  label: "Docs",
  icon: "Library",
};

const sectionResource = (section: OnboardingSection): ResourceRef => ({
  kind: SECTION_KIND,
  uri: `${SECTION_KIND}:${section.id}`,
  id: section.id,
  label: section.label,
  icon: section.icon,
  metadata: { description: section.description },
});

const pageResource = (section: OnboardingSection, page: OnboardingPage): ResourceRef => ({
  kind: PAGE_KIND,
  uri: `${PAGE_KIND}:${section.id}/${page.id}`,
  id: `${section.id}/${page.id}`,
  label: page.label,
  icon: "FileText",
  metadata: { sectionId: section.id, body: page.body },
});

const findSection = (sectionId: string | undefined) => sections.find((section) => section.id === sectionId);

const findPageBySectionPath = (compositeId: string | undefined) => {
  if (!compositeId) return undefined;
  const [sectionId, pageId] = compositeId.split("/");
  const section = findSection(sectionId);
  const page = section?.pages.find((p) => p.id === pageId);
  if (!section || !page) return undefined;
  return { section, page };
};

const pageTreeNode = (section: OnboardingSection, page: OnboardingPage): TreeNode => {
  const resource = pageResource(section, page);
  return {
    id: resource.uri,
    label: page.label,
    icon: "FileText",
    resource,
  };
};

const sectionTreeNode = (section: OnboardingSection): TreeNode => ({
  id: sectionResource(section).uri,
  label: section.label,
  icon: section.icon,
  resource: sectionResource(section),
  children: section.pages.map((page) => pageTreeNode(section, page)),
});

const NavCard = (props: { icon?: string; title: string; description?: string; onClick: () => void }) => {
  const { icon, title, description, onClick } = props;

  return (
    <Box
      as="button"
      onClick={onClick}
      textAlign="left"
      w="full"
      p="md"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="md"
      bg="bg"
      _hover={{ bg: "bg.subtle", borderColor: "border.emphasized" }}
    >
      <HStack gap="sm" align="flex-start">
        {icon ? (
          <Text as="span" color="fg.muted" mt="3xs">
            <WorkbenchIcon name={icon} size={18} />
          </Text>
        ) : null}
        <Stack gap="3xs" minW="0">
          <Text textStyle="title/XS/semibold">{title}</Text>
          {description ? (
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              {description}
            </Text>
          ) : null}
        </Stack>
      </HStack>
    </Box>
  );
};

const DocsHomeWidget = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;

  return (
    <ScrollArea h="full" bg="bg" contentProps={{ p: "lg", display: "flex", flexDirection: "column", gap: "md" }}>
      <Stack gap="3xs">
        <Text textStyle="title/S/semibold">Docs</Text>
        <Text textStyle="paragraph/M/regular" color="fg.muted">
          Pick a category to drill in. The breadcrumb trail above mirrors the path.
        </Text>
      </Stack>
      <Stack gap="sm">
        {sections.map((section) => (
          <NavCard
            key={section.id}
            icon={section.icon}
            title={section.label}
            description={section.description}
            onClick={() => void workbench.resources.openResource(sectionResource(section))}
          />
        ))}
      </Stack>
    </ScrollArea>
  );
};

const SectionWidget = (props: { workbench: WorkbenchCore; resource: ResourceRef | undefined }) => {
  const { workbench, resource } = props;
  const section = findSection(typeof resource?.id === "string" ? resource.id : undefined);

  if (!section) {
    return (
      <Stack h="full" p="lg" gap="sm" bg="bg">
        <Text textStyle="title/S/semibold">Unknown section</Text>
        <Text textStyle="paragraph/M/regular" color="fg.muted">
          Open a category from the docs tree.
        </Text>
      </Stack>
    );
  }

  return (
    <ScrollArea h="full" bg="bg" contentProps={{ p: "lg", display: "flex", flexDirection: "column", gap: "md" }}>
      <Stack gap="3xs">
        <Text textStyle="title/S/semibold">{section.label}</Text>
        <Text textStyle="paragraph/M/regular" color="fg.muted">
          {section.description}
        </Text>
      </Stack>
      <Stack gap="sm">
        {section.pages.map((page) => (
          <NavCard
            key={page.id}
            icon="FileText"
            title={page.label}
            description={page.body}
            onClick={() => void workbench.resources.openResource(pageResource(section, page))}
          />
        ))}
      </Stack>
    </ScrollArea>
  );
};

const PageWidget = (props: { workbench: WorkbenchCore; resource: ResourceRef | undefined }) => {
  const { workbench, resource } = props;
  const match = findPageBySectionPath(typeof resource?.id === "string" ? resource.id : undefined);
  const body = match?.page.body ?? "Open a page from the docs tree.";

  return (
    <ScrollArea h="full" bg="bg" contentProps={{ p: "lg", display: "flex", flexDirection: "column", gap: "md" }}>
      <Stack gap="3xs">
        <Text textStyle="title/S/semibold">{resource?.label ?? "Docs"}</Text>
        <Text textStyle="paragraph/M/regular">{body}</Text>
        <Code colorPalette="gray">{resource?.uri ?? "no resource"}</Code>
      </Stack>
      {match ? (
        <HStack gap="xs">
          <Button
            size="xs"
            variant="outline"
            onClick={() => void workbench.resources.openResource(sectionResource(match.section))}
          >
            Back to {match.section.label}
          </Button>
          <Button size="xs" variant="ghost" onClick={() => void workbench.resources.openResource(docsResource)}>
            Docs home
          </Button>
        </HStack>
      ) : null}
    </ScrollArea>
  );
};

// Each breadcrumb level resolves through the resource controller so the matching
// opener re-runs and keeps the trail authoritative. The current entry stays
// inert — clicking it would just re-open the active widget.
const breadcrumbItemForResource = (
  resources: ResourceRegistry,
  resource: ResourceRef,
  options: { current?: boolean } = {},
): WorkbenchBreadcrumbItem => ({
  title: resource.label ?? "Untitled",
  icon: resource.icon,
  resource,
  onClick: options.current ? undefined : () => void resources.openResource(resource),
});

export const createBreadcrumbModule = (): WorkbenchModuleContribution => ({
  id: "onboarding.breadcrumb",
  activate(ctx) {
    ctx.resources.registerKind({ kind: DOCS_KIND, label: "Docs", icon: "Library" });
    ctx.resources.registerKind({ kind: SECTION_KIND, label: "Section", icon: "BookOpen" });
    ctx.resources.registerKind({ kind: PAGE_KIND, label: "Page", icon: "FileText" });

    // Each opener swaps content into the active main tab via replaceActive so
    // walking up and down the trail does not accumulate one tab per category.
    ctx.resources.registerOpener({
      id: "onboarding.breadcrumb.docs-opener",
      canOpen: (resource) => resource.kind === DOCS_KIND,
      open: (resource, input) => {
        ctx.breadcrumbs.setItems([breadcrumbItemForResource(ctx.resources, docsResource, { current: true })]);
        ctx.layout.openWidget(DOCS_HOME_WIDGET_ID, {
          resource,
          title: resource.label,
          replaceActive: input.replaceActive ?? true,
        });
      },
    });

    ctx.resources.registerOpener({
      id: "onboarding.breadcrumb.section-opener",
      canOpen: (resource) => resource.kind === SECTION_KIND,
      open: (resource, input) => {
        const section = findSection(typeof resource.id === "string" ? resource.id : undefined);
        if (!section) return;
        ctx.breadcrumbs.setItems([
          breadcrumbItemForResource(ctx.resources, docsResource),
          breadcrumbItemForResource(ctx.resources, sectionResource(section), { current: true }),
        ]);
        ctx.layout.openWidget(SECTION_WIDGET_ID, {
          resource,
          title: resource.label,
          replaceActive: input.replaceActive ?? true,
        });
      },
    });

    ctx.resources.registerOpener({
      id: "onboarding.breadcrumb.page-opener",
      canOpen: (resource) => resource.kind === PAGE_KIND,
      open: (resource, input) => {
        const match = findPageBySectionPath(typeof resource.id === "string" ? resource.id : undefined);
        if (!match) return;
        ctx.breadcrumbs.setItems([
          breadcrumbItemForResource(ctx.resources, docsResource),
          breadcrumbItemForResource(ctx.resources, sectionResource(match.section)),
          breadcrumbItemForResource(ctx.resources, pageResource(match.section, match.page), { current: true }),
        ]);
        ctx.layout.openWidget(PAGE_WIDGET_ID, {
          resource,
          title: resource.label,
          replaceActive: input.replaceActive ?? true,
        });
      },
    });

    ctx.renderers.registerRenderer({
      id: DOCS_HOME_RENDERER_ID,
      render: ({ workbench }) => <DocsHomeWidget workbench={workbench} />,
    });
    ctx.renderers.registerRenderer({
      id: SECTION_RENDERER_ID,
      render: ({ workbench, placement }) => <SectionWidget workbench={workbench} resource={placement.resource} />,
    });
    ctx.renderers.registerRenderer({
      id: PAGE_RENDERER_ID,
      render: ({ workbench, placement }) => <PageWidget workbench={workbench} resource={placement.resource} />,
    });

    ctx.renderers.registerTreeRenderer({
      id: BREADCRUMB_TREE_ID,
      title: "Docs",
      defaultExpandedSectionIds: ["docs"],
      defaultExpandedNodeIds: sections.map((section) => sectionResource(section).uri),
      getBody: () => [
        {
          id: "docs",
          nodes: [
            { id: docsResource.uri, label: "Docs home", icon: "Library", resource: docsResource },
            ...sections.map((section) => sectionTreeNode(section)),
          ],
        },
      ],
      getChildren: () => [],
    });

    ctx.layout.registerWidget({
      id: BREADCRUMB_TREE_ID,
      title: "Docs",
      region: "sidebar",
      regionSize: { defaultPx: 240, minPx: 200 },
      rendererId: BREADCRUMB_TREE_ID,
    });
    ctx.layout.registerWidget({
      id: DOCS_HOME_WIDGET_ID,
      title: "Docs",
      region: "main",
      resourceKinds: [DOCS_KIND],
      rendererId: DOCS_HOME_RENDERER_ID,
    });
    ctx.layout.registerWidget({
      id: SECTION_WIDGET_ID,
      title: "Section",
      region: "main",
      resourceKinds: [SECTION_KIND],
      rendererId: SECTION_RENDERER_ID,
    });
    ctx.layout.registerWidget({
      id: PAGE_WIDGET_ID,
      title: "Page",
      region: "main",
      resourceKinds: [PAGE_KIND],
      rendererId: PAGE_RENDERER_ID,
    });

    ctx.layout.openWidget(BREADCRUMB_TREE_ID);

    // Land on the docs home so the breadcrumb shows the root entry on first
    // paint — drilling in from there exercises each level of the trail.
    void ctx.resources.openResource(docsResource);
  },
});
