export const breadcrumbSource = `import {
  createResourceBreadcrumbItems,
  resourceContextMenuPath,
  type ResourceRef,
  type WorkbenchModuleContribution,
} from "@pstdio/workbench";

const DOCS_KIND = "docs.root";
const SECTION_KIND = "docs.section";
const PAGE_KIND = "docs.page";

const docsResource: ResourceRef = {
  kind: DOCS_KIND,
  uri: \`\${DOCS_KIND}:root\`,
  label: "Docs",
  icon: "Library",
};

const sectionResource = (id: string, label = id): ResourceRef => ({
  kind: SECTION_KIND,
  uri: \`\${SECTION_KIND}:\${id}\`,
  id,
  label,
  icon: "BookOpen",
});

export const createBreadcrumbModule = (): WorkbenchModuleContribution => ({
  id: "docs.breadcrumb",
  activate(ctx) {
    ctx.resources.registerKind({ kind: DOCS_KIND, label: "Docs", icon: "Library" });
    ctx.resources.registerKind({ kind: SECTION_KIND, label: "Section", icon: "BookOpen" });
    ctx.resources.registerKind({ kind: PAGE_KIND, label: "Page", icon: "FileText" });
    ctx.commands.registerCommand(
      { id: "docs.copy-link", label: "Copy resource link", icon: "Copy" },
      { execute: (_args, context) => console.log(context?.resource?.uri) },
    );
    ctx.layout.registerMenuItem(resourceContextMenuPath(PAGE_KIND), {
      commandId: "docs.copy-link",
    });

    ctx.resources.registerHierarchyProvider({
      id: "docs.hierarchy",
      canResolve: (resource) => resource.kind === SECTION_KIND || resource.kind === PAGE_KIND,
      getParent: (resource) =>
        resource.kind === SECTION_KIND
          ? docsResource
          : sectionResource(String(resource.metadata?.sectionId ?? "concepts"), "Concepts"),
    });

    ctx.resources.registerPresenter({
      id: "docs.root-presenter",
      canOpen: (resource) => resource.kind === DOCS_KIND,
      open: (resource) => {
        ctx.breadcrumbs.setItems(createResourceBreadcrumbItems(ctx.resources, resource));
        ctx.layout.openPanel("docs.home", { resource });
      },
    });

    ctx.resources.registerPresenter({
      id: "docs.section-presenter",
      canOpen: (resource) => resource.kind === SECTION_KIND,
      open: (resource) => {
        ctx.breadcrumbs.setItems(createResourceBreadcrumbItems(ctx.resources, resource));
        ctx.layout.openPanel("docs.section", { resource, title: resource.label });
      },
    });

    ctx.resources.registerPresenter({
      id: "docs.page-presenter",
      canOpen: (resource) => resource.kind === PAGE_KIND,
      open: (resource) => {
        ctx.breadcrumbs.setItems(createResourceBreadcrumbItems(ctx.resources, resource));
        ctx.layout.openPanel("docs.page", { resource, title: resource.label });
      },
    });
  },
});

// The default Workbench top header renders the breadcrumb controller. Each
// presenter performs one hierarchy walk; generated ancestors navigate through
// resources.openResource(...) and the selected leaf remains inert.`;
