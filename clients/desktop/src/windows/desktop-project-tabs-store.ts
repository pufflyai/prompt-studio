import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { DesktopProjectTabsState } from "../desktop-api";

const isProjectTabsState = (value: unknown): value is DesktopProjectTabsState => {
  if (!value || typeof value !== "object" || !("projectIds" in value)) return false;
  const ids = value.projectIds;
  return (
    Array.isArray(ids) && ids.every((id) => typeof id === "string" && id.trim()) && new Set(ids).size === ids.length
  );
};

export class DesktopProjectTabsStore {
  #writes: Promise<void> = Promise.resolve();

  constructor(private readonly path: string) {}

  flush() {
    return this.#writes;
  }

  async getProjectTabs() {
    await this.#writes;
    try {
      const value: unknown = JSON.parse(await readFile(this.path, "utf8"));
      if (isProjectTabsState(value)) return { projectIds: [...value.projectIds] };
    } catch {
      // A missing or interrupted file starts with no open tabs.
    }
    return { projectIds: [] as string[] };
  }

  async setProjectTabs(value: unknown) {
    if (!isProjectTabsState(value)) throw new Error("Invalid project tabs");
    const content = `${JSON.stringify({ projectIds: [...value.projectIds] })}\n`;
    const write = this.#writes.then(async () => {
      await mkdir(dirname(this.path), { recursive: true });
      await writeFile(`${this.path}.tmp`, content, "utf8");
      await rename(`${this.path}.tmp`, this.path);
    });
    // Keep later writes usable after an error, while returning the failed write to its caller.
    this.#writes = write.catch(() => {});
    await write;
  }
}
