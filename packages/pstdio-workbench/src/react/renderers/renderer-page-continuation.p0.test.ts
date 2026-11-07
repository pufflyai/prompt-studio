import { expect, test } from "bun:test";
import type { CollectionPageRequest } from "@pstdio/sdk/extensions";
import { appendRendererRows, loadRendererPage } from "./renderer-page-continuation";

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

test("a board keeps its shown rows and drops a row the newer page repeats", () => {
  const row = (id: string) => ({ id });
  expect(appendRendererRows([row("a"), row("b")], [row("b"), row("c")], (value) => value.id)).toEqual([
    row("a"),
    row("b"),
    row("c"),
  ]);
});
