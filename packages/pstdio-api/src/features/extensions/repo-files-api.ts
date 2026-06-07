import { resolve } from "node:path";
import type { ArtifactMount } from "@pstdio/sdk/extensions";
import { createFileMount } from "pstdio-extensions";

/** Generic host file primitive: the invocation repo's working tree, scoped to its root. */
export const createRepoFilesApi = (repoPath: string): ArtifactMount => createFileMount(resolve(repoPath));
