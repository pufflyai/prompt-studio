import { describe, expect, it } from "bun:test";

import type { AttributeDescriptor, EnumOption } from "./types";
import { resolveAttributeOptions } from "./use-resolved-attributes";

const staticEnum: AttributeDescriptor = {
  id: "type",
  label: "Type",
  type: {
    kind: "enum",
    options: [
      { value: "worktree", label: "Worktree" },
      { value: "current_branch", label: "Current branch" },
    ],
  },
};

const dateAttribute: AttributeDescriptor = {
  id: "updated",
  label: "Updated",
  type: { kind: "date" },
};

const createSource = (snapshot: EnumOption[]) => ({
  subscribe: () => () => {},
  getSnapshot: () => snapshot,
});

describe("resolveAttributeOptions", () => {
  it("returns static enum descriptors with the same option array reference", () => {
    const [resolved] = resolveAttributeOptions([staticEnum]);
    expect(resolved.type.kind).toBe("enum");
    if (resolved.type.kind !== "enum") throw new Error("expected enum kind");
    expect(resolved.type.options).toBe(staticEnum.type.kind === "enum" ? staticEnum.type.options : null);
  });

  it("materializes source-backed enum options via getSnapshot", () => {
    const snapshot: EnumOption[] = [
      { value: "running", label: "Running", color: "blue" },
      { value: "merged", label: "Merged", color: "green" },
    ];
    const sourced: AttributeDescriptor = {
      id: "status",
      label: "Status",
      type: { kind: "enum", options: createSource(snapshot) },
    };

    const [resolved] = resolveAttributeOptions([sourced]);

    if (resolved.type.kind !== "enum") throw new Error("expected enum kind");
    expect(resolved.type.options).toEqual(snapshot);
  });

  it("materializes source-backed enum-multi options", () => {
    const snapshot: EnumOption[] = [{ value: "bug", label: "Bug" }];
    const sourced: AttributeDescriptor = {
      id: "labels",
      label: "Labels",
      type: { kind: "enum-multi", options: createSource(snapshot) },
    };

    const [resolved] = resolveAttributeOptions([sourced]);

    if (resolved.type.kind !== "enum-multi") throw new Error("expected enum-multi kind");
    expect(resolved.type.options).toEqual(snapshot);
  });

  it("leaves non-enum descriptors untouched", () => {
    const [resolved] = resolveAttributeOptions([dateAttribute]);
    expect(resolved).toBe(dateAttribute);
  });

  it("re-reads the snapshot on every call (no stale caching)", () => {
    let snapshot: EnumOption[] = [{ value: "todo", label: "Todo" }];
    const sourced: AttributeDescriptor = {
      id: "status",
      label: "Status",
      type: {
        kind: "enum",
        options: {
          subscribe: () => () => {},
          getSnapshot: () => snapshot,
        },
      },
    };

    const first = resolveAttributeOptions([sourced])[0];
    if (first.type.kind !== "enum") throw new Error("expected enum kind");
    expect(first.type.options).toHaveLength(1);

    snapshot = [
      { value: "todo", label: "Todo" },
      { value: "done", label: "Done" },
    ];

    const second = resolveAttributeOptions([sourced])[0];
    if (second.type.kind !== "enum") throw new Error("expected enum kind");
    expect(second.type.options).toHaveLength(2);
  });
});
