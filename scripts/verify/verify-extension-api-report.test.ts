import { describe, expect, test } from "bun:test";
import { changedApiEntries, normalizeReport } from "./api-report";

const declaration = (comment: string) => `//#region src/extensions/index.d.ts
${comment}
export declare const open: (target: string) => void;
//#endregion
`;

describe("extension API report", () => {
  test("ignores documentation comments and source file regions", () => {
    expect(normalizeReport(declaration("/** Opens a target. */"))).toBe(
      normalizeReport(declaration("/**\n * Opens a target in the workbench.\n */")),
    );
    expect(normalizeReport(declaration(""))).toBe(normalizeReport(declaration("/** Opens a target. */")));
  });

  test("changes when an API is deprecated", () => {
    const deprecated = normalizeReport(declaration("/**\n * Opens a target.\n * @deprecated Use `navigate`.\n */"));

    expect(deprecated).not.toBe(normalizeReport(declaration("/** Opens a target. */")));
    expect(deprecated).toBe(normalizeReport(declaration("/** @deprecated Use `navigation.open`. */")));
  });

  test("detects added, removed, and changed entrypoints", () => {
    const released = new Map([
      ["extensions", "export declare const open: (target: string) => void;"],
      ["data", "export interface Record { id: string; }"],
      ["prompts", "export interface Prompt { text: string; }"],
    ]);
    const proposed = new Map([
      ["extensions", "export declare const open: (target: number) => void;"],
      ["data", "export interface Record { id: string; }"],
      ["testing", "export declare function setup(): void;"],
    ]);
    expect(changedApiEntries(released, proposed)).toEqual(["extensions", "prompts", "testing"]);
  });

  test("ignores documentation edits but detects deprecations and removed exports", () => {
    const released = new Map([["extensions", declaration("/** Opens a target. */")]]);
    expect(changedApiEntries(released, new Map([["extensions", declaration("/** Updated docs. */")]]))).toEqual([]);
    expect(changedApiEntries(released, new Map([["extensions", declaration("/** @deprecated */")]]))).toEqual([
      "extensions",
    ]);
    expect(changedApiEntries(released, new Map([["extensions", "export {};"]]))).toEqual(["extensions"]);
  });
});
