import { expect, test } from "bun:test";
import type { TreeNodePage, TreeViewSection } from "../../../core";
import { createTreePages } from "./tree-pages";

test("visible collections append siblings once, retain rows on failure, and retry the same page", async () => {
  let finish!: (page: TreeNodePage) => void;
  let calls = 0;
  const first = { id: "one", label: "One" };
  let fail = true;
  const sections: TreeViewSection[] = [
    {
      id: "history",
      nodes: [first],
      nextPage: () => {
        calls++;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    },
  ];
  const controller = new AbortController();
  const pages = createTreePages(controller.signal, () => {});
  const read = () => pages.sections(sections)[0]!;
  const pending = read().pagination!.loadMore();
  await read().pagination!.loadMore();
  expect(calls).toBe(1);
  expect(read().pagination!.loading).toBe(true);
  finish({
    nodes: [first, { id: "two", label: "Two" }],
    nextPage: async () => {
      if (fail) throw new Error("Offline");
      return { nodes: [{ id: "three", label: "Three" }] };
    },
  });
  await pending;
  expect(read().nodes.map((node) => node.id)).toEqual(["one", "two"]);
  expect(read().nodes[0]).toBe(first);
  await read().pagination!.loadMore();
  expect(read().pagination!.error).toBe("Offline");
  expect(read().nodes).toHaveLength(2);
  fail = false;
  await read().pagination!.loadMore();
  expect(read().nodes.map((node) => node.id)).toEqual(["one", "two", "three"]);
  expect(read().pagination).toBeUndefined();
});

test("replacing a snapshot aborts pending pages and ignores late responses", async () => {
  let finish!: (page: TreeNodePage) => void;
  let signal!: AbortSignal;
  let updates = 0;
  const sections: TreeViewSection[] = [
    {
      id: "workspace",
      nodes: [
        {
          id: "group",
          label: "Sessions",
          children: [],
          nextPage: (input) => {
            signal = input;
            return new Promise((resolve) => {
              finish = resolve;
            });
          },
        },
      ],
    },
  ];
  const controller = new AbortController();
  const pages = createTreePages(controller.signal, () => updates++);
  const pending = pages.sections(sections)[0]!.nodes[0]!.pagination!.loadMore();
  controller.abort();
  expect(signal.aborted).toBe(true);
  const before = updates;
  finish({ nodes: [{ id: "stale", label: "Stale" }] });
  await pending;
  expect(updates).toBe(before);
  expect(pages.sections(sections)[0]!.nodes[0]!.children).toEqual([]);
});

test("paged children inside lazy folders retain both initial and appended children", async () => {
  const sections: TreeViewSection[] = [
    { id: "history", nodes: [{ id: "folder", label: "Folder", collapsible: true }] },
  ];
  const children = {
    folder: [
      {
        id: "group",
        label: "Sessions",
        children: [{ id: "first", label: "First" }],
        nextPage: async () => ({ nodes: [{ id: "second", label: "Second" }] }),
      },
    ],
  };
  const pages = createTreePages(new AbortController().signal, () => {});
  const read = () => pages.sections(sections, children)[0]!.nodes[0]!.children![0]!;
  expect(read().children!.map((node) => node.id)).toEqual(["first"]);
  await read().pagination!.loadMore();
  expect(read().children!.map((node) => node.id)).toEqual(["first", "second"]);
  expect(read().pagination).toBeUndefined();
});

test("an authoritative empty lazy read clears previous children", () => {
  const sections = [
    { id: "history", nodes: [{ id: "folder", label: "Folder", children: [{ id: "old", label: "Old" }] }] },
  ];
  const pages = createTreePages(new AbortController().signal, () => {});
  expect(pages.sections(sections, { folder: [] })[0]!.nodes[0]!.children).toEqual([]);
});

test("unpaged trees retain their section and row identities", () => {
  const sections = [{ id: "history", nodes: [{ id: "folder", label: "Folder", children: [] }] }];
  const pages = createTreePages(new AbortController().signal, () => {});
  expect(pages.sections(sections)).toBe(sections);
});

test("refresh retains loaded depth and old rows until fresh cursor pages finish", async () => {
  const first = { id: "first", label: "First" };
  const sections: TreeViewSection[] = [
    { id: "history", nodes: [first], nextPage: async () => ({ nodes: [{ id: "second", label: "Old title" }] }) },
  ];
  const previous = createTreePages(new AbortController().signal, () => {});
  await previous.sections(sections)[0]!.pagination!.loadMore();
  let finish!: (page: TreeNodePage) => void;
  const current: TreeViewSection[] = [
    {
      ...sections[0]!,
      nextPage: async () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
  ];
  const refreshed = createTreePages(new AbortController().signal, () => {}, previous.snapshot());
  const read = () => refreshed.sections(current)[0]!;
  expect(read().nodes.map((node) => node.label)).toEqual(["First", "Old title"]);
  const pending = refreshed.revalidate();
  expect(read().nodes).toHaveLength(2);
  finish({ nodes: [{ id: "second", label: "New title" }] });
  await pending;
  expect(read().nodes.map((node) => node.label)).toEqual(["First", "New title"]);
  expect(read().pagination).toBeUndefined();
});
