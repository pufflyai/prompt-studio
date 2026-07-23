import { createResourceBreadcrumbItems, type ResourceRef, type TreeNode } from "../../core";

export const DOCS_KIND = "onboarding.breadcrumb.docs";
export const SECTION_KIND = "onboarding.breadcrumb.section";
export const PAGE_KIND = "onboarding.breadcrumb.session";

export interface OnboardingPage {
  id: string;
  label: string;
  body: string;
  status: "in_progress" | "completed";
}

export interface OnboardingSection {
  id: string;
  label: string;
  icon: string;
  description: string;
  pages: OnboardingPage[];
}

export const sections: OnboardingSection[] = [
  {
    id: "concepts",
    label: "Concepts",
    icon: "BookOpen",
    description: "The vocabulary the workbench shell is built on.",
    pages: [
      {
        id: "regions",
        label: "Regions",
        body: "Named layout slots widgets pin themselves to.",
        status: "in_progress",
      },
      {
        id: "widgets",
        label: "Widgets",
        body: "Registrations that place a renderer into an region.",
        status: "completed",
      },
    ],
  },
  {
    id: "surfaces",
    label: "Surfaces",
    icon: "PanelsTopLeft",
    description: "Where contributions show up in the running shell.",
    pages: [
      {
        id: "menus",
        label: "Menus",
        body: "Command-backed actions beside breadcrumb and tree resources.",
        status: "in_progress",
      },
      {
        id: "commands",
        label: "Commands",
        body: "Executable actions wired to menus and shortcuts.",
        status: "completed",
      },
    ],
  },
];

export const docsResource: ResourceRef = {
  kind: DOCS_KIND,
  uri: `${DOCS_KIND}:root`,
  id: "root",
  label: "Docs",
  icon: "Library",
};

export const sectionResource = (section: OnboardingSection): ResourceRef => ({
  kind: SECTION_KIND,
  uri: `${SECTION_KIND}:${section.id}`,
  id: section.id,
  label: section.label,
  icon: section.icon,
  metadata: { description: section.description },
});

export const pageResource = (section: OnboardingSection, page: OnboardingPage): ResourceRef => ({
  kind: PAGE_KIND,
  uri: `${PAGE_KIND}:${section.id}/${page.id}`,
  id: `${section.id}/${page.id}`,
  label: page.label,
  icon: "MessageCircle",
  metadata: { sectionId: section.id, body: page.body, status: page.status },
});

export const findSection = (sectionId: string | undefined) => sections.find((section) => section.id === sectionId);

export const findPageBySectionPath = (compositeId: string | undefined) => {
  if (!compositeId) return undefined;
  const [sectionId, pageId] = compositeId.split("/");
  const section = findSection(sectionId);
  const page = section?.pages.find((candidate) => candidate.id === pageId);
  if (!section || !page) return undefined;
  return { section, page };
};

const pageTreeNode = (section: OnboardingSection, page: OnboardingPage): TreeNode => {
  const resource = pageResource(section, page);
  return {
    id: resource.uri,
    label: page.label,
    icon: "MessageCircle",
    resource,
  };
};

export const breadcrumbItemsFor = (
  resources: Parameters<typeof createResourceBreadcrumbItems>[0],
  resource: ResourceRef,
) => {
  const items = createResourceBreadcrumbItems(resources, resource);
  if (resource.kind === PAGE_KIND) items[items.length - 1]!.indicator = "session-status";
  return items;
};

export const sectionTreeNode = (section: OnboardingSection): TreeNode => ({
  id: sectionResource(section).uri,
  label: section.label,
  icon: section.icon,
  resource: sectionResource(section),
  children: section.pages.map((page) => pageTreeNode(section, page)),
});
