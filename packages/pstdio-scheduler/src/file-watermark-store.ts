import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { WatermarkStore } from "./types";
import { parseWatermarks, serializeWatermarks } from "./watermark-store";

export const createFileWatermarkStore = (path: string): WatermarkStore => {
  return {
    async load() {
      try {
        const raw = await readFile(path, "utf8");
        return parseWatermarks(raw);
      } catch {
        return new Map();
      }
    },
    async save(watermarks) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, serializeWatermarks(watermarks), "utf8");
    },
  };
};
