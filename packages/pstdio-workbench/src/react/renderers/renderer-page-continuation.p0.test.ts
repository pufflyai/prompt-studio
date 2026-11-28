import { expect, test } from "bun:test";
import type { CollectionPageRequest } from "@pstdio/sdk/extensions";
import { appendRendererRows, loadRendererPage, refreshRendererWindow } from "./renderer-page-continuation";

const request: CollectionPageRequest = {
  limit: 100,
  offset: 100,
  cursor: "after-100",
  revision: "r1",
  fields: ["title"],
  search: "",
};

test("a continuation rejected after the data changed loads the same position on the current data", async () => {
  const asked: CollectionPageRequest[] = [];
  const loaded = await loadRendererPage(
    request,
    async (page) => {
      asked.push(page);
      if (page.revision) throw new Error("Query revision is stale; restart the query");
      return `page at ${page.offset}`;
    },
    new AbortController().signal,
  );
  expect(asked).toEqual([request, { ...request, cursor: undefined, revision: undefined }]);
  expect(loaded).toEqual({ value: "page at 100", request: { ...request, cursor: undefined, revision: undefined } });
});

test("a failed first read is reported, not repeated", async () => {
  let calls = 0;
  const first = { ...request, offset: 0, cursor: undefined, revision: undefined };
  await expect(
    loadRendererPage(
      first,
      async () => {
        calls++;
        throw new Error("Provider failed");
      },
      new AbortController().signal,
    ),
  ).rejects.toThrow("Provider failed");
  expect(calls).toBe(1);
});

test("a cancelled continuation is not asked again", async () => {
  const controller = new AbortController();
  let calls = 0;
  await expect(
    loadRendererPage(
      request,
      async () => {
        calls++;
        controller.abort();
        throw new Error("Aborted");
      },
      controller.signal,
    ),
  ).rejects.toThrow("Aborted");
  expect(calls).toBe(1);
});

test("a board keeps its shown rows and drops duplicate continuation rows", () => {
  const row = (id: string) => ({ id });
  expect(appendRendererRows([row("a"), row("b")], [row("b"), row("c")], (value) => value.id)).toEqual([
    row("a"),
    row("b"),
    row("c"),
  ]);
});

test("a revision change between batches restarts the loaded window at its first page", async () => {
  const reads: [number, string | undefined][] = [];
  let revision = "r2";
  const result = await refreshRendererWindow(
    request,
    async ({ offset = 0, revision: pinned }) => {
      reads.push([offset, pinned]);
      if (pinned === "r2") {
        revision = "r3";
        throw new Error("Collection query revision is stale; restart the query");
      }
      return {
        rows: [`${revision} row ${offset}`],
        page: { cursor: "next", revision, total: 300, filteredTotal: 300, groups: [] },
      };
    },
    new AbortController().signal,
  );
  expect(result.rows).toEqual(["r3 row 0", "r3 row 100"]);
  expect(reads).toEqual([
    [0, undefined],
    [100, "r2"],
    [0, undefined],
    [100, "r3"],
  ]);
});
