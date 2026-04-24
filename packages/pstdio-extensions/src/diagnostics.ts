import type { ExtensionDiagnostic, ExtensionDiagnosticCode, ExtensionDiagnosticRelated } from "@pstdio/sdk/extensions";

type DiagnosticInput = {
  code: ExtensionDiagnosticCode;
  message: string;
  extensionId?: string;
  sourcePath?: string;
  related?: ExtensionDiagnosticRelated[];
};

export const createErrorDiagnostic = (input: DiagnosticInput) =>
  ({
    ...input,
    severity: "error",
  }) satisfies ExtensionDiagnostic;
