import { describe, expect, test } from "bun:test";
import { createMutableAttributeSource, toCreateFields } from "./kanban-renderer-contribution-helpers";

const localize = (value: unknown, fallback?: string) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "$l10n" in value) {
    const localized = value as { $l10n: string; default?: string };
    return localized.default ?? localized.$l10n;
  }
  return fallback ?? "";
};

const recordWith = (params: Record<string, unknown>) =>
  ({ id: "r", extensionId: "e", title: "R", createRow: { commandId: "c", params } }) as never;

test("extension list columns survive initial loading and query refreshes", () => {
  const source = createMutableAttributeSource(
    { id: "threads", extensionId: "example.radar", title: "Threads", queryHandlerId: "query" },
    [
      {
        id: "site",
        label: "Site",
        type: { kind: "string" },
        display: { kind: "text" },
        listColumn: { placement: "start", size: "sm" },
      },
    ],
    localize,
    (_record, attribute) => attribute,
  );
  if (!("getSnapshot" in source.source)) throw new Error("Expected live attributes");
  expect(source.source.getSnapshot()[0]).toMatchObject({
    display: { kind: "text" },
    listColumn: { placement: "start", size: "sm" },
  });
  source.set([
    {
      id: "url",
      label: { $l10n: "source", default: "Open source" },
      type: { kind: "string" },
      display: { kind: "link" },
      listColumn: { placement: "end", size: "xs" },
    },
  ]);
  expect(source.source.getSnapshot()[0]).toMatchObject({
    label: "Open source",
    display: { kind: "link" },
    listColumn: { placement: "end", size: "xs" },
  });
});

describe("toCreateFields", () => {
  test("maps a markdown param to a markdown field", () => {
    const [field] = toCreateFields(recordWith({ content: { type: "markdown", required: true } }), localize);

    expect(field).toMatchObject({ id: "content", type: "markdown", required: true });
  });

  test("maps a files param to a files field", () => {
    const [field] = toCreateFields(recordWith({ attachments: { type: "files", multiple: true } }), localize);

    expect(field).toMatchObject({ id: "attachments", type: "files" });
  });

  test("resolves a localized label instead of falling back to the param id", () => {
    const [field] = toCreateFields(
      recordWith({ content: { type: "markdown", label: { $l10n: "createRow.content", default: "Description" } } }),
      localize,
    );

    expect(field.label).toBe("Description");
  });

  test("preserves supported fields when another valid param type cannot be rendered", () => {
    const fields = toCreateFields(
      recordWith({
        title: { type: "text", required: true },
        agent: { type: "harness" },
      }),
      localize,
    );

    expect(fields).toEqual([expect.objectContaining({ id: "title", type: "text", required: true })]);
  });
});
