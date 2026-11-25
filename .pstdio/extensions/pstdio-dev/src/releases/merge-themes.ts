import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import type { MergeThemeCoverage } from "./types";

interface MergeThemeSnapshot extends MergeThemeCoverage {
  version: 1;
  repository: string;
  byPull: Record<string, number>;
}

type ExtensionFiles = NonNullable<ExtensionContextBase["extensionFiles"]>;
type Analysis = "merge-themes" | "bug-failure-patterns";

const readSnapshot = async (files: ExtensionFiles, repository: string | undefined, analysis: Analysis) => {
  const path = `releases/${analysis}.json`;
  if (!(await files.exists(path))) return;
  const snapshot = JSON.parse(await files.readText(path)) as MergeThemeSnapshot;
  const validIndex = (index: number) => Number.isInteger(index) && index >= 0 && index < snapshot.names.length;
  if (
    snapshot?.version !== 1 ||
    typeof snapshot.analyzedAt !== "string" ||
    !Number.isFinite(Date.parse(snapshot.analyzedAt)) ||
    !Array.isArray(snapshot.names) ||
    !snapshot.names.length ||
    snapshot.names.some((name) => typeof name !== "string" || !name.trim()) ||
    new Set(snapshot.names).size !== snapshot.names.length ||
    !snapshot.byPull ||
    typeof snapshot.byPull !== "object" ||
    Array.isArray(snapshot.byPull) ||
    Object.entries(snapshot.byPull).some(([number, index]) => !/^[1-9]\d*$/.test(number) || !validIndex(index)) ||
    (snapshot.validationIndices !== undefined &&
      (!Array.isArray(snapshot.validationIndices) ||
        new Set(snapshot.validationIndices).size !== snapshot.validationIndices.length ||
        snapshot.validationIndices.some((index) => !validIndex(index))))
  ) {
    throw new Error(`Invalid analysis snapshot in ${path}.`);
  }
  if (snapshot.repository !== repository) return;
  return snapshot;
};

export const readMergeAnalysis = async (files: ExtensionFiles, repository: string | undefined, analysis: Analysis) => {
  try {
    const snapshot = await readSnapshot(files, repository, analysis);
    if (!snapshot) return {};
    const { analyzedAt, names, validationIndices, byPull } = snapshot;
    return { coverage: { analyzedAt, names, validationIndices }, byPull };
  } catch (error) {
    return { error: String(error) };
  }
};
