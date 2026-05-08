import type { JsonObject } from "@pstdio/sdk/extensions";
import type { ExtensionDiagnostic, ExtensionDiagnosticSeverity } from "../types/runtime";

type CreateDiagnosticInput = {
  code: string;
  message: string;
  severity?: ExtensionDiagnosticSeverity;
  extensionId?: string;
  commandId?: string;
  sourcePath?: string;
  metadata?: JsonObject;
};

export const createDiagnostic = (input: CreateDiagnosticInput): ExtensionDiagnostic => ({
  code: input.code,
  severity: input.severity ?? "error",
  message: input.message,
  extensionId: input.extensionId,
  commandId: input.commandId,
  sourcePath: input.sourcePath,
  metadata: input.metadata,
});
