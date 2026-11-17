import { createWorkbench, type TreeNodePage, type TreePageLoader } from "../../../core";

export const createTreePaginationFixture = (changed: () => void) => {
  const workbench = createWorkbench();
  const fixture = { workbench, requests: 0, fail: false, hold: false, nested: false, pending: [] as Array<() => void> };
  const nodes = (start: number, filter: string) =>
    Array.from({ length: Math.min(20, 65 - start) }, (_, i) => ({
      id: `${filter}:session-${start + i}`,
      label: `${filter ? `${filter} ` : ""}Session ${start + i + 1}`,
    }));
  const nextPage = (start: number, filter: string): TreePageLoader | undefined =>
    start >= 65
      ? undefined
      : async (signal) => {
          fixture.requests++;
          changed();
          if (fixture.hold) await new Promise<void>((resolve) => fixture.pending.push(resolve));
          signal.throwIfAborted();
          if (fixture.fail) {
            fixture.fail = false;
            throw new Error("Could not load older sessions.");
          }
          const page: TreeNodePage = { nodes: nodes(start, filter), nextPage: nextPage(start + 20, filter) };
          return page;
        };
  workbench.views.registerView({
    id: "history",
    title: "Session history",
    body: {
      kind: "tree",
      searchable: true,
      searchPlaceholder: "Search sessions",
      defaultExpandedNodeIds: ["sessions"],
      getBody: (ctx) => {
        const first = { nodes: nodes(0, ctx.filter ?? ""), nextPage: nextPage(20, ctx.filter ?? "") };
        if (!fixture.nested) return [{ id: "history", ...first }];
        return [
          {
            id: "history",
            nodes: [
              { id: "sessions", label: "Sessions", collapsible: true, children: first.nodes, nextPage: first.nextPage },
            ],
          },
        ];
      },
      getChildren: (node) => node.children ?? [],
    },
  });
  return fixture;
};
