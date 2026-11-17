import type { ExtensionsCheckResponse } from "pstdio-api-contracts";
import { formatExtensionsCheck } from "./extension-runtime";

export class RepoScopedExtensionNeedsProjectFolderError extends Error {
  constructor(extensionId: string) {
    super(
      `Extension "${extensionId}" declares pstdio.scope "repo". Install it from a project opened from a local folder.`,
    );
    this.name = "RepoScopedExtensionNeedsProjectFolderError";
  }
}

type ExtensionsCheck = ExtensionsCheckResponse;

/** The message can be a full check report for the CLI; callers that show one line use `firstError`. */
export class ExtensionValidationFailedError extends Error {
  firstError: string;
  diagnostics?: ExtensionsCheck["diagnostics"];

  constructor(message: string, firstError = message, diagnostics?: ExtensionsCheck["diagnostics"]) {
    super(message);
    this.name = "ExtensionValidationFailedError";
    this.firstError = firstError;
    this.diagnostics = diagnostics;
  }
}

export const checkFailed = (check: ExtensionsCheck) => {
  const report = `Extension validation failed:\n${formatExtensionsCheck(check)}`;
  const first = check.diagnostics.find((diagnostic) => diagnostic.severity === "error");
  return new ExtensionValidationFailedError(report, first?.message ?? report, check.diagnostics);
};
