import type { TreeNode, TreePageLoader, TreeViewSection } from "../renderers/tree-renderer-types";

/** Continuation rows need the same provider ownership and scoped identities as the first page. */
export const projectNavigationTreePage = (
  load: TreePageLoader | undefined,
  project: (node: TreeNode) => TreeNode,
): TreePageLoader | undefined =>
  load
    ? async (signal) => {
        const page = await load(signal);
        return { nodes: page.nodes.map(project), nextPage: projectNavigationTreePage(page.nextPage, project) };
      }
    : undefined;

export const mergeNavigationTreePages = (
  first?: TreePageLoader,
  second?: TreePageLoader,
): TreePageLoader | undefined => {
  if (!first) return second;
  if (!second) return first;
  return async (signal) => {
    const pages = await Promise.all([first(signal), second(signal)]);
    return {
      nodes: pages.flatMap((page) => page.nodes),
      nextPage: mergeNavigationTreePages(pages[0]!.nextPage, pages[1]!.nextPage),
    };
  };
};

export const mergeNavigationTreeSection = (sections: TreeViewSection[], section: TreeViewSection) => {
  const index = sections.findIndex((candidate) => candidate.id === section.id);
  if (index < 0) {
    sections.push(section);
    return;
  }
  const current = sections[index]!;
  sections[index] = {
    ...current,
    nodes: [...current.nodes, ...section.nodes],
    nextPage: mergeNavigationTreePages(current.nextPage, section.nextPage),
  };
};
