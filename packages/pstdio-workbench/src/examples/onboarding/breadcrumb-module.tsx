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

    // Each presenter swaps content into the active main tab via replaceActive so
    // walking up and down the trail does not accumulate one tab per category.
    ctx.resources.registerPresenter({
      id: "onboarding.breadcrumb.docs-presenter",
      canOpen: (resource) => resource.kind === DOCS_KIND,
      open: (resource, input) => {
        ctx.breadcrumbs.setItems(breadcrumbItemsFor(ctx.resources, resource));
        return ctx.layout.openPanel(DOCS_HOME_WIDGET_ID, {
          strategy: input.replaceActive ? { kind: "replace-active" } : { kind: "activate-or-open" },
          resource,
          title: resource.label,
        });
      },
    });

    ctx.resources.registerPresenter({
      id: "onboarding.breadcrumb.section-presenter",
      canOpen: (resource) => resource.kind === SECTION_KIND,
      open: (resource, input) => {
        findSection(typeof resource.id === "string" ? resource.id : undefined);
        ctx.breadcrumbs.setItems(breadcrumbItemsFor(ctx.resources, resource));
        return ctx.layout.openPanel(SECTION_WIDGET_ID, {
          strategy: input.replaceActive ? { kind: "replace-active" } : { kind: "activate-or-open" },
          resource,
          title: resource.label,
        });
      },
    });

    ctx.resources.registerPresenter({
      id: "onboarding.breadcrumb.page-presenter",
      canOpen: (resource) => resource.kind === PAGE_KIND,
      open: (resource, input) => {
        findPageBySectionPath(typeof resource.id === "string" ? resource.id : undefined);
        ctx.breadcrumbs.setItems(breadcrumbItemsFor(ctx.resources, resource));
        return ctx.layout.openPanel(PAGE_WIDGET_ID, {
          strategy: input.replaceActive ? { kind: "replace-active" } : { kind: "activate-or-open" },
          resource,
          title: resource.label,
        });
      },
    });

    ctx.renderers.registerRenderer({
      id: DOCS_HOME_RENDERER_ID,
      render: ({ workbench }) => <DocsHomeWidget workbench={workbench} />,
    });
    ctx.renderers.registerRenderer({
      id: SECTION_RENDERER_ID,
      render: ({ workbench, instance }) => <SectionWidget workbench={workbench} resource={instance.resource} />,
    });
    ctx.renderers.registerRenderer({
      id: PAGE_RENDERER_ID,
      render: ({ workbench, instance }) => <PageWidget workbench={workbench} resource={instance.resource} />,
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

    ctx.layout.registerPanel({
      closable: false,
      id: BREADCRUMB_TREE_ID,
      title: "Docs",
      region: "sidenav",
      regionSize: { defaultPx: 240, minPx: 200 },
      rendererId: BREADCRUMB_TREE_ID,
    });
    ctx.layout.registerPanel({
      closable: false,
      id: DOCS_HOME_WIDGET_ID,
      title: "Docs",
      region: "main",
      resourceKinds: [DOCS_KIND],
      rendererId: DOCS_HOME_RENDERER_ID,
    });
    ctx.layout.registerPanel({
      closable: false,
      id: SECTION_WIDGET_ID,
      title: "Section",
      region: "main",
      resourceKinds: [SECTION_KIND],
      rendererId: SECTION_RENDERER_ID,
    });
    ctx.layout.registerPanel({
      closable: false,
      id: PAGE_WIDGET_ID,
      title: "Page",
      region: "main",
      resourceKinds: [PAGE_KIND],
      rendererId: PAGE_RENDERER_ID,
    });

    ctx.layout.openPanel(BREADCRUMB_TREE_ID);

    const initialSection = sections[0];
    const initialPage = initialSection?.pages[0];
    if (initialSection && initialPage) {
      void ctx.resources.openResource(pageResource(initialSection, initialPage));
    }
  },
});
