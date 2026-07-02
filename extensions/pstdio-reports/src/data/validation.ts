const SAFE_WORKSPACE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SAFE_REPORT_NAME = /^[a-z0-9][a-z0-9_-]*$/;

const hasUnsafeSegment = (value: string) =>
  !value || value === "." || value === ".." || value.includes("/") || value.includes("\\") || value.includes("\0");

export const assertSafeWorkspaceShorthand = (value: string) => {
  if (hasUnsafeSegment(value) || !SAFE_WORKSPACE.test(value)) throw new Error(`Unsafe workspace shorthand: ${value}`);
};

export const assertSafeReportName = (value: string) => {
  if (hasUnsafeSegment(value) || value === "files" || !SAFE_REPORT_NAME.test(value)) {
    throw new Error(`Unsafe report name: ${value}`);
  }
};

export const assertSafeReportFileName = (value: string) => {
  if (hasUnsafeSegment(value)) throw new Error(`Unsafe report file name: ${value}`);
};

export const nameFromKind = (kind: string) =>
  kind
    .toLowerCase()
    .replaceAll(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
