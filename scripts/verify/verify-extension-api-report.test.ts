import { describe, expect, test } from "bun:test";
import { normalizeReport } from "./verify-extension-api-report";

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
    expect(normalizeReport(declaration(""))).toBe("export declare const open: (target: string) => void;\n");
  });

  test("changes when an API is deprecated", () => {
    const deprecated = normalizeReport(declaration("/**\n * Opens a target.\n * @deprecated Use `navigate`.\n */"));

    expect(deprecated).not.toBe(normalizeReport(declaration("/** Opens a target. */")));
    expect(deprecated).toBe(normalizeReport(declaration("/** @deprecated Use `navigation.open`. */")));
  });
});
