import { win32 } from "node:path";

export type WindowsPathAction = "install" | "uninstall";

export const updateWindowsPath = (current: string, directory: string, action: WindowsPathAction) => {
  const normalize = (entry: string) =>
    win32.normalize(entry.trim().replace(/^"|"$/g, "")).replace(/\\+$/, "").toLowerCase();
  const matches = (entry: string) => normalize(entry) === normalize(directory);
  const entries = current.split(";");
  if (action === "uninstall") return entries.filter((entry) => !matches(entry)).join(";");
  if (entries.some(matches)) return current;
  const separator = current ? ";" : "";
  return `${current}${separator}${directory}`;
};
