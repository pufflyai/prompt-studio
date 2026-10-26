import { lstat, readdir, rmdir, unlink } from "node:fs/promises";
import { join } from "node:path";

const removeEntry = async (path: string, directory: boolean) => {
  try {
    if (!directory) {
      await unlink(path);
      return;
    }
    const entries = await readdir(path, { withFileTypes: true });
    const results = await Promise.allSettled(
      entries.map((entry) => removeEntry(join(path, entry.name), !entry.isSymbolicLink() && entry.isDirectory())),
    );
    const errors = results.filter((result) => result.status === "rejected").map((result) => result.reason);
    if (errors.length) throw new AggregateError(errors, `Could not remove owned directory ${path}`);
    await rmdir(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
};

// Temporary fixture workaround: ADR 0110. Completion owns every queued operation.
export const removeCoreFixture = async (root: string) => {
  try {
    const info = await lstat(root);
    await removeEntry(root, !info.isSymbolicLink() && info.isDirectory());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
};
