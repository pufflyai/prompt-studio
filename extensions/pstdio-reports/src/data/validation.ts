import { assertSafePathSegment } from "@pstdio/sdk/data";

const SAFE_WORKSPACE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SAFE_REPORT_NAME = /^[a-z0-9][a-z0-9_-]*$/;

export const assertSafeWorkspaceShorthand = (value: string) => {
  assertSafePathSegment(value);
  if (!SAFE_WORKSPACE.test(value)) throw new Error(`Unsafe workspace shorthand: ${value}`);
};

export const assertSafeReportName = (value: string) => {
  assertSafePathSegment(value);
  if (value === "files" || !SAFE_REPORT_NAME.test(value)) {
    throw new Error(`Unsafe report name: ${value}`);
  }
};

export const assertSafeReportFileName = (value: string) => {
  assertSafePathSegment(value);
};

export const nameFromKind = (kind: string) =>
  kind
    .toLowerCase()
    .replaceAll(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
