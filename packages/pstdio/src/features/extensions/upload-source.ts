import { readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, isAbsolute, resolve } from "node:path";
import { expandHomePath } from "pstdio-paths";
import { extensionUploadFiles } from "./upload-source-files";

export const isLocalExtensionSource = (source: string) =>
  isAbsolute(source) || /^\.{1,2}[/\\]/.test(source) || /^~[/\\]/.test(source);

export const uploadExtensionSource = (
  source: string,
  options: {
    installName?: string;
    force?: boolean;
    skipInstall?: boolean;
    development?: boolean;
  } = {},
) => {
  const root = realpathSync(resolve(expandHomePath(source, homedir())));
  const body = new FormData();
  body.append("kind", "upload");
  body.append("folderName", basename(root));
  if (options.installName) body.append("installName", options.installName);
  for (const key of ["force", "skipInstall", "development"] as const) {
    if (options[key] !== undefined) body.append(key, String(options[key]));
  }
  for (const file of extensionUploadFiles(root)) {
    body.append("files", new File([readFileSync(file.path)], file.name), file.name);
  }
  return body;
};
