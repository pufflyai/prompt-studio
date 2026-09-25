import { expect, test } from "bun:test";
import type { NavigationTarget, TreeViewSection } from "../../../core";
import { resolveTreeListSelection } from "./tree-list-adapter";

test.each(["body", "first-file", "second-file"])("selects only the declared ticket document: %s", (documentId) => {
  const page = { kind: "page", extensionId: "author.planner", id: "ticket" } as const;
  const resource = { type: "ticket", id: "ticket-1", metadata: { documentId } };
  const nodes = ["body", "first-file", "second-file"].map((id) => ({
    id,
    label: id,
    target: { kind: "page" as const, page, resource: { ...resource, metadata: { documentId: id } } },
  }));
  const sections: TreeViewSection[] = [{ id: "documents", nodes }];

  expect(
    resolveTreeListSelection({
      sections,
      childrenByNodeId: {},
      activeLocation: { page, resource },
      activeResource: resource,
      selectedNodeId: documentId,
    }),
  ).toBe(documentId);
});

const notesPage = { kind: "page", extensionId: "author.notes", id: "notes" } as const;
const noteResource = (id: string) => ({ type: "note", id, extensionId: "author.notes", projectId: "project" });
const notePanel = (id: string) => ({
  kind: "panel" as const,
  panel: { kind: "page-slot" as const, page: notesPage, id: "note" },
  resource: noteResource(id),
});

for (const kind of ["panel", "compound"] as const) {
  const sections: TreeViewSection[] = [
    {
      id: "notes",
      nodes: ["first", "second", "third"].map((id) => ({
        id,
        label: id,
        target: (kind === "panel"
          ? notePanel(id)
          : {
              kind: "compound",
              targets: [{ kind: "page", page: notesPage }, notePanel(id)],
            }) satisfies NavigationTarget,
      })),
    },
  ];

  test(`${kind} navigation keeps the active note selected when its page entry is clicked`, () => {
    expect(
      resolveTreeListSelection({
        sections: [
          {
            id: "navigation",
            nodes: [{ id: "notes-page", label: "Notes", target: { kind: "page", page: notesPage } }],
          },
          ...sections,
        ],
        childrenByNodeId: {},
        activeLocation: { page: notesPage },
        activeResource: noteResource("first"),
        selectedNodeId: "notes-page",
      }),
    ).toBe("first");
  });

  test.each(["first", "second"])(`${kind} navigation selects the active note after a tab switch: %s`, (id) => {
    expect(
      resolveTreeListSelection({
        sections,
        childrenByNodeId: {},
        activeLocation: { page: notesPage },
        activeResource: noteResource(id),
        selectedNodeId: id === "first" ? "second" : "first",
      }),
    ).toBe(id);
  });

  test(`${kind} navigation selects the remaining note after deleting the selected note`, () => {
    expect(
      resolveTreeListSelection({
        sections: [{ ...sections[0]!, nodes: sections[0]!.nodes.slice(1) }],
        childrenByNodeId: {},
        activeLocation: { page: notesPage },
        activeResource: noteResource("second"),
        selectedNodeId: "first",
      }),
    ).toBe("second");
  });

  test(`${kind} navigation clears the note selection when the last note tab closes`, () => {
    expect(
      resolveTreeListSelection({
        sections,
        childrenByNodeId: {},
        activeLocation: { page: notesPage },
        selectedNodeId: "first",
      }),
    ).toBeUndefined();
  });

  test(`${kind} navigation leaves notes unselected when only their page is open`, () => {
    expect(
      resolveTreeListSelection({
        sections,
        childrenByNodeId: {},
        activeLocation: { page: notesPage },
      }),
    ).toBeUndefined();
  });
}
