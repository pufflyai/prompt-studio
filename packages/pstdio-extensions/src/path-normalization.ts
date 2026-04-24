import { posix } from "node:path";

export const normalizeCliPath = (path: string) => {
  const segments = path
    .trim()
    .split(/\s+/)
    .filter((segment) => segment.length > 0);

  return {
    path: segments.join(" "),
    pathSegments: segments,
  };
};

export const normalizeArtifactPath = (path: string) => {
  const slashPath = path.replaceAll("\\", "/");
  if (slashPath.startsWith("/") || slashPath.includes("\0")) return null;

  const normalized = posix.normalize(slashPath).replace(/\/$/, "");
  if (normalized === ".pstdio" || normalized.startsWith(".pstdio/")) return normalized;

  return null;
};
