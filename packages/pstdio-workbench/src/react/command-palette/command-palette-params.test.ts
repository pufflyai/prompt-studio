import { describe, expect, test } from "bun:test";
import {
  buildCommandParamInitialValues,
  hasCommandParameters,
  listCommandParamEntries,
  normalizeCommandParamValues,
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
            kind: "workspace",
            uri: "pstdio://workspace/workspace-1",
            id: "workspace-1",
            label: "T-1_A1",
          },
        },
      ),
    ).toEqual({
      workspaceId: "workspace-1",
      workspace: '{"kind":"workspace","uri":"pstdio://workspace/workspace-1","id":"workspace-1","label":"T-1_A1"}',
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
          empty: { type: "text" },
        },
        {
          title: "New ticket",
          count: "3",
          enabled: true,
          tags: '["bug"]',
          empty: "",
        },
      ),
    ).toEqual({ title: "New ticket", count: 3, enabled: true, tags: ["bug"] });
  });
});
