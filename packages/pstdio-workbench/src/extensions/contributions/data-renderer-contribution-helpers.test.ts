import { describe, expect, test } from "bun:test";
import { toCreateFields } from "./data-renderer-contribution-helpers";

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

  // A dropped field renders a form that silently omits what the extension asked for.
  test("rejects a param type the create form cannot render", () => {
    expect(() => toCreateFields(recordWith({ agent: { type: "harness" } }), localize)).toThrow(/harness/);
  });
});
