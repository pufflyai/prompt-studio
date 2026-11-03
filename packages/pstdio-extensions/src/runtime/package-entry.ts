import { existsSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { ExtensionDiagnostic } from "../types/runtime";
import { createDiagnostic } from "./diagnostics";

export const resolveEntry = (
  diagnostics: ExtensionDiagnostic[],
  packagePath: string,
  packageDir: string,
  main: string,
) => {
  if (isAbsolute(main)) {
    diagnostics.push(
      createDiagnostic({
        code: "extension_manifest_invalid_value",
        message: `main "${main}" must be a relative path`,
        sourcePath: packagePath,
      }),
    );
    return null;
  }

  const resolved = resolve(packageDir, main);
  const rel = relative(packageDir, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    diagnostics.push(
      createDiagnostic({
        code: "extension_manifest_invalid_value",
        message: `main "${main}" resolves outside the package directory`,
        sourcePath: packagePath,
      }),
    );
    return null;
  }

  if (!existsSync(resolved)) {
    diagnostics.push(
      createDiagnostic({
        code: "extension_entry_not_found",
        message: `main "${main}" resolves to ${resolved} which does not exist`,
        sourcePath: packagePath,
      }),
    );
    return null;
  }

  const realPackageDir = realpathSync(packageDir);
  const realResolved = realpathSync(resolved);
  const realRel = relative(realPackageDir, realResolved);
  if (realRel.startsWith("..") || isAbsolute(realRel)) {
    diagnostics.push(
      createDiagnostic({
        code: "extension_manifest_invalid_value",
        message: `main "${main}" resolves outside the package directory`,
        sourcePath: packagePath,
      }),
    );
    return null;
  }

  if (!statSync(resolved).isFile()) {
    diagnostics.push(
      createDiagnostic({
        code: "extension_manifest_invalid_value",
        message: `main "${main}" must point to a file`,
        sourcePath: packagePath,
      }),
    );
    return null;
  }

  return resolved;
};
