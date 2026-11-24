import { chmod, chown, mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { SaveDialogOptions, SaveDialogReturnValue } from "electron";
import { deviceFileInputSchema } from "pstdio-api-contracts/extension-kernel";

export const createDeviceFileSaver =
  (
    choose: (options: SaveDialogOptions) => Promise<SaveDialogReturnValue>,
    write = (path: string, bytes: Uint8Array) => writeFile(path, bytes),
  ) =>
  async (value: unknown) => {
    const input = deviceFileInputSchema.parse(value);
    // Copy before awaiting the dialog so a caller cannot change the selected content.
    const bytes = new Uint8Array(input.data instanceof ArrayBuffer ? input.data.slice(0) : input.data.slice());
    try {
      const destination = await choose({
        title: "Save as",
        defaultPath: input.name,
        properties: ["showOverwriteConfirmation"],
      });
      if (destination.canceled || !destination.filePath) return { status: "cancelled" as const };
      // A failed export must preserve any file the person chose to replace.
      const staging = await mkdtemp(join(dirname(destination.filePath), ".pstdio-export-"));
      try {
        const path = join(staging, "content");
        await write(path, bytes);
        const existing = await stat(destination.filePath).catch((error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return undefined;
          throw error;
        });
        // Rename replaces access metadata too; keep a private destination private.
        if (existing) {
          if (process.platform !== "win32") {
            const staged = await stat(path);
            if (staged.uid !== existing.uid || staged.gid !== existing.gid)
              await chown(path, existing.uid, existing.gid);
          }
          await chmod(path, existing.mode & 0o777);
        }
        await rename(path, destination.filePath);
        return { status: "saved" as const };
      } finally {
        await rm(staging, { recursive: true, force: true });
      }
    } catch {
      // Native I/O messages include private device paths. Keep them out of guest errors.
      throw new Error("Could not save the file. Check available space and folder permissions, then try again.");
    }
  };
