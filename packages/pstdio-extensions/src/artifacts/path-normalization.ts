import { posix } from "node:path";

export type NormalizedCliPath = {
  segments: string[];
  key: string;
};

export const normalizeCliPath = (path: string[]): NormalizedCliPath | null => {
  const segments = path.map((segment) => segment.trim()).filter((segment) => segment.length > 0);
  if (segments.length === 0) return null;
  return { segments, key: segments.join(" ") };
};

export const normalizeArtifactMountPath = (path: string) => {
  if (path.includes("\0")) return null;

  const slashPath = path.replaceAll("\\", "/");
  if (slashPath.startsWith("/")) return null;

  const normalized = posix.normalize(slashPath).replace(/\/$/, "");
  if (normalized === "" || normalized === ".") return null;
  if (normalized === ".." || normalized.startsWith("../")) return null;
  if (normalized === ".pstdio" || normalized.startsWith(".pstdio/")) return null;

  return normalized;
};
