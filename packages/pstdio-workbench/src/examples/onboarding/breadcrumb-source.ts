export const breadcrumbSource = `import type {
  ResourceRef,
  ResourceRegistry,
  WorkbenchBreadcrumbItem,
  WorkbenchModuleContribution,
} from "pstdio-workbench/core";

const DOCS_KIND = "docs.root";
const SECTION_KIND = "docs.section";
const PAGE_KIND = "docs.page";

const DOCS_HOME_WIDGET_ID = "docs.home";
const SECTION_WIDGET_ID = "docs.section";
const PAGE_WIDGET_ID = "docs.page";

const docsResource: ResourceRef = {
  kind: DOCS_KIND,
  uri: \`\${DOCS_KIND}:root\`,
  label: "Docs",
  icon: "Library",
};

const sectionResource = (id: string, label: string, icon: string): ResourceRef => ({
  kind: SECTION_KIND,
  uri: \`\${SECTION_KIND}:\${id}\`,
  id,
  label,
  icon,
});

// One breadcrumb entry per resource. Clicking re-runs the opener, which keeps
// the controller as the single source of truth for the trail — the entry for
// the current resource stays inert so a click on it is a no-op.
const trailItem = (
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
  id: "docs.breadcrumb",
  activate(ctx) {
    ctx.resources.registerKind({ kind: DOCS_KIND, label: "Docs", icon: "Library" });
    ctx.resources.registerKind({ kind: SECTION_KIND, label: "Section", icon: "BookOpen" });
    ctx.resources.registerKind({ kind: PAGE_KIND, label: "Page", icon: "FileText" });

    // A widget per category lets every breadcrumb level land on a real page —
    // root, section, and leaf each have their own renderer, opened by the
    // matching resource opener.
    ctx.resources.registerOpener({
      id: "docs.root-opener",
      canOpen: (resource) => resource.kind === DOCS_KIND,
      open: (resource) => {
        ctx.breadcrumbs.setItems([trailItem(ctx.resources, docsResource, { current: true })]);
        ctx.layout.openWidget(DOCS_HOME_WIDGET_ID, { resource });
      },
    });

    ctx.resources.registerOpener({
      id: "docs.section-opener",
      canOpen: (resource) => resource.kind === SECTION_KIND,
      open: (resource) => {
        ctx.breadcrumbs.setItems([
          trailItem(ctx.resources, docsResource),
          trailItem(ctx.resources, resource, { current: true }),
        ]);
        ctx.layout.openWidget(SECTION_WIDGET_ID, { resource, title: resource.label });
      },
    });

    ctx.resources.registerOpener({
      id: "docs.page-opener",
      canOpen: (resource) => resource.kind === PAGE_KIND,
      open: (resource) => {
        const sectionId = String(resource.metadata?.sectionId ?? "concepts");
        const sectionLabel = String(resource.metadata?.sectionLabel ?? "Concepts");
        const sectionIcon = String(resource.metadata?.sectionIcon ?? "BookOpen");

        ctx.breadcrumbs.setItems([
          trailItem(ctx.resources, docsResource),
          trailItem(ctx.resources, sectionResource(sectionId, sectionLabel, sectionIcon)),
          trailItem(ctx.resources, resource, { current: true }),
        ]);

        ctx.layout.openWidget(PAGE_WIDGET_ID, { resource, title: resource.label });
      },
    });
  },
});

// Render the trail anywhere a workbench is in scope. The view subscribes to
// workbench.breadcrumbs.store and returns null when the trail is empty:
//
//   import { WorkbenchBreadcrumbView } from "pstdio-workbench/react";
//   <WorkbenchBreadcrumbView workbench={workbench} />
//
// The default Workbench top header already renders it, so most hosts only
// need to call ctx.breadcrumbs.setItems(...) from their resource openers.`;
