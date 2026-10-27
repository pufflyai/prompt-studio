import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import type { NativeBuildOutput } from "./native-build-output";

export const publishFrameArchive = async (root: string, outputs: NativeBuildOutput[]) => {
  const scripts: Record<string, string> = {};
  const styles: string[] = [];
  for (const output of outputs) {
    if (output.type === "chunk")
      scripts[output.fileName] = output.code.replace(
        /(["'])\.\/([^"']+\.js)\1/g,
        (_match, quote, file) => `${quote}canvas-preview:${file}${quote}`,
      );
    else if (output.fileName.endsWith(".css")) styles.push(String(output.source));
  }
  const entry = outputs.find((file) => file.type === "chunk" && file.isEntry)!.fileName;
  const payload = gzipSync(JSON.stringify({ scripts, styles, entry })).toString("base64");
  await writeFile(
    resolve(root, "frame-bundle.ts"),
    `// Generated source-component preview modules.\nexport default ${JSON.stringify(payload)};\n`,
  );
};
