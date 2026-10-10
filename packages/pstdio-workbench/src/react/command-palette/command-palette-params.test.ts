import { describe, expect, test } from "bun:test";
import {
  buildCommandParamInitialValues,
  createCommandFilesParamValue,
  hasCommandParameters,
  listCommandParamEntries,
  mergeCommandParamArgs,
  normalizeCommandParamValues,
  resolveCommandResourceParams,
} from "./command-palette-params";

describe("command palette params", () => {
  test("detects commands with declared params", () => {
    expect(hasCommandParameters(undefined)).toBe(false);
    expect(hasCommandParameters({})).toBe(false);
    expect(hasCommandParameters({ title: { type: "text" } })).toBe(true);
  });
  test("builds editable initial values from defaults and contributed args", () => {
    expect(
      buildCommandParamInitialValues(
        {
          title: { type: "text", defaultValue: "Untitled" },
          amount: { type: "number", defaultValue: 1 },
          tags: { type: "json", defaultValue: [] },
        },
        { amount: 2 },
      ),
    ).toEqual({ title: "Untitled", amount: "2", tags: "[]" });
  });
  test("keeps existing file refs separate from pending browser files", () => {
    expect(
      buildCommandParamInitialValues(
        {
          files: { type: "files", defaultValue: ["default-ref"] },
        },
        { files: ["preset-ref"] },
      ),
    ).toEqual({ files: { refs: ["preset-ref"], uploads: [] } });
  });
  test("keeps one existing ref for a single-file parameter", () => {
    expect(
      buildCommandParamInitialValues({ files: { type: "files", multiple: false } }, { files: ["first", "second"] }),
    ).toEqual({ files: { refs: ["first"], uploads: [] } });
  });
  test("deduplicates selection options by value", () => {
    const entries = listCommandParamEntries({
      labels: {
        type: "multi-select",
        options: [
          { value: "bug", label: "Bug" },
          { value: "bug", label: "Bug duplicate" },
          { value: "feature", label: "Feature" },
        ],
      },
    });
    expect(entries[0]?.options).toEqual([
      { value: "bug", label: "Bug" },
      { value: "feature", label: "Feature" },
    ]);
  });
  test("omits parameters resolved from the active resource", () => {
    expect(
      listCommandParamEntries({
        ticketId: { type: "text", required: true, resolvedFrom: "resource" },
        context: { type: "longtext" },
      }).map((entry) => entry.key),
    ).toEqual(["context"]);
  });
  test("builds editable resource param initial values from command context", () => {
    expect(
      buildCommandParamInitialValues(
        {
          workspaceId: { type: "text", required: true },
          workspace: { type: "resource", resourceType: "workspace", required: true },
          status: { type: "text", defaultValue: "review-ready" },
        },
        undefined,
        {
          resource: {
            type: "workspace",
            id: "workspace-1",
            label: "T-1_A1",
          },
        },
      ),
    ).toEqual({
      workspaceId: "workspace-1",
      workspace: '{"type":"workspace","id":"workspace-1","label":"T-1_A1"}',
      status: "review-ready",
    });
  });
  test("normalizes form values into command params", () => {
    expect(
      normalizeCommandParamValues(
        {
          title: { type: "text" },
          count: { type: "number" },
          enabled: { type: "boolean" },
          tags: { type: "json" },
          workspace: { type: "workspace" },
          empty: { type: "text" },
        },
        {
          title: "New ticket",
          count: "3",
          enabled: true,
          tags: '["bug"]',
          workspace: '{"providerId":"pstdio.worktree","params":{"base":"main"}}',
          empty: "",
        },
      ),
    ).toEqual({
      title: "New ticket",
      count: 3,
      enabled: true,
      tags: ["bug"],
      workspace: { providerId: "pstdio.worktree", params: { base: "main" } },
    });
  });
  test("preserves pending file values for host preparation", () => {
    const file = new File(["first"], "first.csv", { type: "text/csv" });
    const files = createCommandFilesParamValue({
      refs: ["existing-ref"],
      uploads: [{ id: "first", file, status: "queued" }],
    });
    expect(normalizeCommandParamValues({ files: { type: "files", required: true } }, { files })).toEqual({ files });
  });
  test("requires either an existing ref or a pending file", () => {
    expect(() =>
      normalizeCommandParamValues(
        { files: { type: "files", label: "Data files", required: true } },
        { files: createCommandFilesParamValue() },
      ),
    ).toThrow("Missing required parameter: Data files");
  });
});

test("preserves raw hidden action args and resolves missing values from resource metadata and identity", () => {
  const schema = {
    instance: { type: "text", resolvedFrom: "resource" as const },
    ids: { type: "list", resolvedFrom: "resource" as const },
    instanceId: { type: "text", resolvedFrom: "resource" as const },
    title: { type: "text" },
  };
  const args = { instance: "explicit", ids: ["one", "two"], title: "Original" };
  const resolved = resolveCommandResourceParams(schema, args, {
    resource: { type: "instance", id: "first", metadata: { instance: "metadata" } },
  });
  expect(resolved).toEqual({ instance: "explicit", ids: ["one", "two"], instanceId: "first" });
  expect(mergeCommandParamArgs(args, { ...resolved, title: "Edited" }, schema)).toEqual({
    instance: "explicit",
    ids: ["one", "two"],
    instanceId: "first",
    title: "Edited",
  });
  expect(
    resolveCommandResourceParams(schema, undefined, {
      resource: { type: "instance", id: "second", metadata: { instance: "metadata" } },
    }).instance,
  ).toBe("metadata");
});

test("cleared optional input values replace static action defaults", () => {
  const schema = { locale: { type: "select" }, tags: { type: "multi-select" } };
  const normalized = normalizeCommandParamValues(schema, { locale: "", tags: [] });
  expect(mergeCommandParamArgs({ source: "toolbar", locale: "de", tags: ["old"] }, normalized, schema)).toEqual({
    source: "toolbar",
  });
});
