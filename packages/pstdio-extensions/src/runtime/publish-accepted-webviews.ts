import { cpSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { withFileMutationLock } from "pstdio-paths";
import { acceptedRevisionPath, type PreparedExtensionRevision, preparedRevisionState } from "./prepared-revision";

export const publishAcceptedWebviews = (input: {
  sourcePath: string;
  expectedState: string;
  outputs: { id: string; distDir: string }[];
}) => {
  const pointer = acceptedRevisionPath(input.sourcePath);
  return withFileMutationLock(pointer, () => {
    const accepted: PreparedExtensionRevision = JSON.parse(readFileSync(pointer, "utf8"));
    if (preparedRevisionState(accepted) !== input.expectedState) return false;
    for (const output of input.outputs) {
      const artifact = accepted.webviews?.[output.id];
      if (!artifact) return false;
      const stage = `${output.distDir}.staging-${crypto.randomUUID()}`;
      try {
        mkdirSync(dirname(stage), { recursive: true });
        cpSync(artifact.distDir, stage, { recursive: true });
        writeFileSync(join(stage, "build-signature.txt"), `prepared:${artifact.id}`);
        rmSync(output.distDir, { recursive: true, force: true });
        renameSync(stage, output.distDir);
      } finally {
        rmSync(stage, { recursive: true, force: true });
      }
    }
    return true;
  });
};
