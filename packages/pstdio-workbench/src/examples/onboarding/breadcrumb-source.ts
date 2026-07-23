export const breadcrumbSource = `import {
  createResourceBreadcrumbItems,
  type ResourceRef,
  type WorkbenchModuleContribution,
} from "pstdio-workbench/core";

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

    ctx.resources.registerHierarchyProvider({
      id: "docs.hierarchy",
      canResolve: (resource) => resource.kind === SECTION_KIND || resource.kind === PAGE_KIND,
      getParent: (resource) =>
        resource.kind === SECTION_KIND
          ? docsResource
          : sectionResource(String(resource.metadata?.sectionId ?? "concepts"), "Concepts"),
    });

    ctx.resources.registerOpener({
      id: "docs.root-opener",
      canOpen: (resource) => resource.kind === DOCS_KIND,
      open: (resource) => {
        ctx.breadcrumbs.setItems(createResourceBreadcrumbItems(ctx.resources, resource));
        ctx.layout.openWidget("docs.home", { resource });
      },
    });

    ctx.resources.registerOpener({
      id: "docs.section-opener",
      canOpen: (resource) => resource.kind === SECTION_KIND,
      open: (resource) => {
        ctx.breadcrumbs.setItems(createResourceBreadcrumbItems(ctx.resources, resource));
        ctx.layout.openWidget("docs.section", { resource, title: resource.label });
      },
    });

    ctx.resources.registerOpener({
      id: "docs.page-opener",
      canOpen: (resource) => resource.kind === PAGE_KIND,
      open: (resource) => {
        ctx.breadcrumbs.setItems(createResourceBreadcrumbItems(ctx.resources, resource));
        ctx.layout.openWidget("docs.page", { resource, title: resource.label });
      },
    });
  },
});

// The default Workbench top header renders the breadcrumb controller. Each
// opener performs one hierarchy walk; generated ancestors navigate through
// resources.openResource(...) and the selected leaf remains inert.`;
