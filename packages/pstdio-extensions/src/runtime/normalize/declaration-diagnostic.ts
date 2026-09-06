import type { z } from "zod";
import type { NormalizedExtension } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import type { Accumulator } from "./accumulator";

export const validateDeclaration = (input: {
  ext: NormalizedExtension;
  source: LoadedExtensionSource;
  runtime: Accumulator;
  kind: string;
  contribution: { id: string };
  schema: z.ZodType;
}) => {
  const result = input.schema.safeParse(input.contribution);
  if (result.success) return true;
  for (const issue of result.error.issues) {
    const paths = issue.code === "unrecognized_keys" ? issue.keys.map((key) => [...issue.path, key]) : [issue.path];
    for (const path of paths) {
      const collection = input.kind === "navigation-item" ? "navigationItems" : `${input.kind}s`;
      const fieldPath = [collection, input.contribution.id, ...path].join(".");
      const expected = issue.code === "unrecognized_keys" ? "a declared field in the public contract" : issue.message;
      const code = input.kind === "page" && path[0] === "slots" ? "invalid_page_slot" : `invalid_${input.kind}`;
      input.runtime.diagnostics.push(
        createDiagnostic({
          code,
          extensionId: input.ext.id,
          sourcePath: input.source.sourcePath,
          message: `Extension "${input.ext.id}" ${input.kind} "${input.contribution.id}" field "${fieldPath}": expected ${expected}`,
          metadata: { contributionId: input.contribution.id, fieldPath, expected },
        }),
      );
    }
  }
  return false;
};
