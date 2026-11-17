import { dlopen, ptr, toArrayBuffer } from "bun:ffi";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { getSystemErrorName } from "node:util";
import { supportsNativeRecovery } from "./platform";

const component = (name: string) => {
  if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\0"))
    throw new Error("Recovery publication requires one directory entry");
  return Buffer.from(`${name}\0`);
};

const loadLibrary = (darwin: boolean) =>
  dlopen(darwin ? "/usr/lib/libSystem.B.dylib" : "libc.so.6", {
    // macOS: RENAME_EXCL. Linux (glibc 2.28+): RENAME_NOREPLACE.
    [darwin ? "renameatx_np" : "renameat2"]: { args: ["int", "ptr", "int", "ptr", "u32"], returns: "int" },
    [darwin ? "__error" : "__errno_location"]: { args: [], returns: "ptr" },
  });

/**
 * Renames `from` to `to` inside one held parent directory and refuses an existing `to`,
 * including an empty directory. See ADR 0138: a check followed by an ordinary rename can
 * replace a destination created in between, so there is no weaker fallback.
 * `parent` must still be the directory identified by `identity` when it is opened.
 */
export const publishRecoveryStaging = async (input: {
  parent: string;
  identity: { dev: bigint; ino: bigint };
  from: string;
  to: string;
}) => {
  if (!supportsNativeRecovery())
    throw Object.assign(new Error("Restoring a folder is not supported on this platform yet"), {
      code: "ENOTSUP",
    });
  const darwin = process.platform === "darwin";
  const from = component(input.from);
  const to = component(input.to);
  const directory = await open(input.parent, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    const held = await directory.stat({ bigint: true });
    if (held.dev !== input.identity.dev || held.ino !== input.identity.ino)
      throw Object.assign(new Error("The destination's parent folder moved during the restore"), {
        code: "EXDEV",
      });
    let library: ReturnType<typeof loadLibrary>;
    try {
      library = loadLibrary(darwin);
    } catch (cause) {
      // musl and glibc before 2.28 have no compatible `renameat2`; there is no weaker fallback.
      throw Object.assign(new Error("This system's C library cannot publish a folder without replacing"), {
        code: "ENOTSUP",
        cause,
      });
    }
    try {
      const native = library.symbols;
      const rename = native[darwin ? "renameatx_np" : "renameat2"]!;
      const flags = darwin ? 0x4 : 0x1;
      const errno = new DataView(toArrayBuffer(native[darwin ? "__error" : "__errno_location"]!()!, 0, 4));
      if (rename(directory.fd, ptr(from), directory.fd, ptr(to), flags) !== 0) {
        const value = errno.getInt32(0, true);
        throw Object.assign(new Error("Publishing the restored folder failed"), {
          errno: value,
          code: value > 0 ? getSystemErrorName(-value) : "EIO",
        });
      }
    } finally {
      library.close();
    }
  } finally {
    await directory.close();
  }
};
