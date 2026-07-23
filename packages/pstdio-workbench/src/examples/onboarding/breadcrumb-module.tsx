import { resourceContextMenuPath, type WorkbenchModuleContribution } from "../../core";
import {
  breadcrumbItemsFor,
  DOCS_KIND,
  docsResource,
  findPageBySectionPath,
  findSection,
  PAGE_KIND,
  pageResource,
  SECTION_KIND,
  sectionResource,
  sections,
  sectionTreeNode,
} from "./breadcrumb-data";
import { DocsHomeWidget, PageWidget, SectionWidget } from "./breadcrumb-widgets";

const BREADCRUMB_TREE_ID = "onboarding.breadcrumb.tree";
const DOCS_HOME_WIDGET_ID = "onboarding.breadcrumb.home";
const DOCS_HOME_RENDERER_ID = "onboarding.breadcrumb.home.renderer";
const SECTION_WIDGET_ID = "onboarding.breadcrumb.section";
const SECTION_RENDERER_ID = "onboarding.breadcrumb.section.renderer";
const PAGE_WIDGET_ID = "onboarding.breadcrumb.page";
const PAGE_RENDERER_ID = "onboarding.breadcrumb.page.renderer";

export const createBreadcrumbModule = (): WorkbenchModuleContribution => ({
  id: "onboarding.breadcrumb",
  activate(ctx) {
    ctx.resources.registerKind({ kind: DOCS_KIND, label: "Docs", icon: "Library" });
    ctx.resources.registerKind({ kind: SECTION_KIND, label: "Section", icon: "BookOpen" });
    ctx.resources.registerKind({ kind: PAGE_KIND, label: "Session", icon: "MessageCircle" });
    ctx.resources.registerHierarchyProvider({
      id: "onboarding.breadcrumb.hierarchy",
      canResolve: (resource) => resource.kind === SECTION_KIND || resource.kind === PAGE_KIND,
      getParent: (resource) => {
        if (resource.kind === SECTION_KIND) return docsResource;
        const match = findPageBySectionPath(resource.id);
        return match ? sectionResource(match.section) : undefined;
      },
    });
    ctx.commands.registerCommand(
      { id: "onboarding.breadcrumb.copy-link", label: "Copy resource link", icon: "Copy" },
      {
        execute: (_args, context) => {
          if (!context?.resource) return;
          ctx.notifications.show({
            level: "success",
            title: "Resource link copied",
            message: context.resource.uri,
          });
        },
      },
    );
    ctx.commands.registerCommand(
      { id: "onboarding.breadcrumb.open-side", label: "Open beside current resource", icon: "PanelRightOpen" },
      {
        execute: (_args, context) => {
          if (!context?.resource) return;
          ctx.notifications.show({
            level: "info",
            title: "Resource action",
            message: `Opened ${context.resource.label ?? context.resource.kind} beside the current resource.`,
          });
        },
      },
    );
    for (const kind of [SECTION_KIND, PAGE_KIND]) {
      ctx.layout.registerMenuItem(resourceContextMenuPath(kind), {
        commandId: "onboarding.breadcrumb.copy-link",
        order: 10,
      });
      ctx.layout.registerMenuItem(resourceContextMenuPath(kind), {
        commandId: "onboarding.breadcrumb.open-side",
        order: 20,
      });
    }

    // Each opener swaps content into the active main tab via replaceActive so
    // walking up and down the trail does not accumulate one tab per category.
    ctx.resources.registerOpener({
      id: "onboarding.breadcrumb.docs-opener",
      canOpen: (resource) => resource.kind === DOCS_KIND,
      open: (resource, input) => {
        ctx.breadcrumbs.setItems(breadcrumbItemsFor(ctx.resources, resource));
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
        ctx.breadcrumbs.setItems(breadcrumbItemsFor(ctx.resources, resource));
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
        ctx.breadcrumbs.setItems(breadcrumbItemsFor(ctx.resources, resource));
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
      region: "sidenav",
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

    const initialSection = sections[0];
    const initialPage = initialSection?.pages[0];
    if (initialSection && initialPage) {
      void ctx.resources.openResource(pageResource(initialSection, initialPage));
    }
  },
});
