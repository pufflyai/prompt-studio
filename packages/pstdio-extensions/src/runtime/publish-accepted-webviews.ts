import { constants, cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { withFileMutationLock } from "pstdio-paths";
import {
  acceptedRevisionPath,
  type PreparedExtensionRevision,
  preparedCacheRoot,
  preparedRevisionState,
} from "./prepared-revision";
import { recordPublishedReleaseWebview, recordPublishedWebviewRevision } from "./published-webview-revision";

export const publishAcceptedWebviews = (input: {
  sourcePath: string;
  expectedState: string;
  outputs: { id: string; distDir: string }[];
}) => {
  const pointer = acceptedRevisionPath(input.sourcePath);
  return withFileMutationLock(pointer, () => {
    const accepted: PreparedExtensionRevision = JSON.parse(readFileSync(pointer, "utf8"));
    if (preparedRevisionState(accepted) !== input.expectedState) return false;
    const releaseViews = join(preparedCacheRoot(), "revisions", accepted.id, "webviews");
    for (const output of input.outputs) {
      const artifact = accepted.webviews?.[output.id];
      if (!artifact) return false;
      const viewIndex = relative(releaseViews, artifact.distDir);
      if (accepted.prebuiltRelease && /^(0|[1-9]\d*)$/.test(viewIndex)) {
        if (!existsSync(join(artifact.distDir, "module.js"))) return false;
        mkdirSync(dirname(output.distDir), { recursive: true });
        recordPublishedReleaseWebview(output.distDir, accepted.id, viewIndex, artifact.id);
        continue;
      }
      const stage = `${output.distDir}.staging-${crypto.randomUUID()}`;
      try {
        mkdirSync(dirname(stage), { recursive: true });
        cpSync(artifact.distDir, stage, { recursive: true, mode: constants.COPYFILE_FICLONE });
        writeFileSync(join(stage, "build-signature.txt"), `prepared:${artifact.id}`);
        rmSync(output.distDir, { recursive: true, force: true });
        renameSync(stage, output.distDir);
        recordPublishedWebviewRevision(output.distDir, `prepared:${artifact.id}`);
      } finally {
        rmSync(stage, { recursive: true, force: true });
      }
    }
    return true;
  });
};
