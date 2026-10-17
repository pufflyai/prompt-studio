import type { CommandExecuteResponse } from "@pstdio/sdk/api";

const storageVersions = Symbol("file storage versions");
interface ObservedContent {
  [storageVersions]?: Record<string, string>;
}
export const fileStorageVersions = (content: unknown) =>
  (content as ObservedContent | undefined)?.[storageVersions] ?? {};
export const attachFileStorageVersions = <T extends object>(content: T, response: unknown) => {
  const value = (response as CommandExecuteResponse | undefined)?.outcome?.data?.fileStorageVersions;
  if (value && typeof value === "object" && !Array.isArray(value)) Object.assign(content, { [storageVersions]: value });
  return content;
};
export const copyFileStorageVersions = <T extends object>(content: T, source: unknown) =>
  Object.assign(content, { [storageVersions]: fileStorageVersions(source) });
