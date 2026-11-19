import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

type WebviewBuildImport = { path: string; kind: string };
type WebviewBuildOutput = {
  cssBundle?: string;
  entryPoint?: string;
  imports: WebviewBuildImport[];
  inputs: Record<string, unknown>;
};

export const readWebviewBuildMetadata = (metafilePath: string) =>
  JSON.parse(readFileSync(metafilePath, "utf8")) as {
    inputs: Record<string, { imports: WebviewBuildImport[] }>;
    outputs: Record<string, WebviewBuildOutput>;
  };

const entryStyleFile = "entry-style.txt";
const isStylesheet = (file: string) => /^[\w.-]+\.css$/.test(file);

export const readWebviewEntryStyles = (distDir: string) => {
  try {
    const stylesheet = readFileSync(join(distDir, entryStyleFile), "utf8");
    return isStylesheet(stylesheet) ? [stylesheet] : [];
  } catch {
    // Single-entry builds already use module.css.
    return existsSync(join(distDir, "module.css")) ? ["module.css"] : [];
  }
};

export const readBatchedWebviewStyles = (metafilePath: string, distDir: string) => {
  return new Map(
    Object.entries(readWebviewBuildMetadata(metafilePath).outputs).flatMap(([file, output]) =>
      output.cssBundle ? [[resolve(distDir, file), resolve(distDir, output.cssBundle)] as const] : [],
    ),
  );
};

export const recordWebviewEntryStyle = (distDir: string, stylesheet: string) => {
  if (!isStylesheet(stylesheet) || !existsSync(join(distDir, stylesheet))) {
    throw new Error(`Missing or invalid webview entry stylesheet: ${stylesheet}`);
  }
  writeFileSync(join(distDir, entryStyleFile), stylesheet);
};
