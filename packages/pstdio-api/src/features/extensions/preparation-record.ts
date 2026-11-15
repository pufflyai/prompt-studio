import { readFileSync } from "node:fs";

// A peer may finish or recover this record between enumeration and reading it.
export const readPreparationRecord = <T>(path: string) => {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
};
