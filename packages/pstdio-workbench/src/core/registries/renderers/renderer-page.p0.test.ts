import { expect, test } from "bun:test";
import { acceptRendererPage } from "./renderer-page";

const request = { limit: 100, offset: 0, fields: ["title"], search: "" };
const result = {
  rows: [{ id: "one" }],
  page: {
    revision: "one",
    cursor: null,
    total: 10,
    filteredTotal: 1,
    groups: [{ field: "status", value: "ready", count: 1 }],
  },
};

test("page metadata describes the same revision as its continuation", () => {
  expect(acceptRendererPage(result, request)).toEqual(result);
  expect(() => acceptRendererPage(result, { ...request, revision: "older", cursor: "older-page" })).toThrow("revision");
});

test("bounded page providers cannot silently fall back to full results or inconsistent counts", () => {
  expect(() =>
    acceptRendererPage(
      { rows: Array.from({ length: 101 }, (_, id) => ({ id: String(id) })), page: result.page },
      request,
    ),
  ).toThrow("limit");
  expect(() => acceptRendererPage({ ...result, page: { ...result.page, filteredTotal: 11 } }, request)).toThrow(
    "count",
  );
  expect(() => acceptRendererPage({ rows: [] }, request)).toThrow("metadata");
  expect(() => acceptRendererPage({ ...result, page: { ...result.page, filteredTotal: 0 } }, request)).toThrow("count");
});
