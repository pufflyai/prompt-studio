import { resourceKey } from "@pstdio/sdk/extensions";
import type { TreeViewSection } from "../renderers/tree-renderer-types";
import type { NavigationTreeContext } from "./navigation-tree-registry";

const scopeKey = (context: NavigationTreeContext) => JSON.stringify([context.projectId, resourceKey(context.resource)]);

// Each contribution keeps only its latest scope. Removing it also removes its snapshot.
export const createNavigationTreeSnapshots = () => {
  const snapshots = new Map<string, { scope: string; sections?: TreeViewSection[] }>();
  const get = (id: string, context: NavigationTreeContext) => {
    const snapshot = snapshots.get(id);
    return snapshot?.scope === scopeKey(context) ? snapshot.sections : undefined;
  };
  return {
    get,
    begin(id: string, context: NavigationTreeContext) {
      const snapshot = { scope: scopeKey(context), sections: get(id, context) };
      snapshots.set(id, snapshot);
      return {
        sections: snapshot.sections,
        complete(sections: TreeViewSection[]) {
          if (snapshots.get(id) === snapshot) snapshot.sections = sections;
        },
      };
    },
    delete: (id: string) => snapshots.delete(id),
  };
};
