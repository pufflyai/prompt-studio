import { dlopen, ptr, toArrayBuffer } from "bun:ffi";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { join, toNamespacedPath } from "node:path";
import { getSystemErrorName } from "node:util";
import { supportsNativeRecovery } from "../../services/project-recovery/platform";
import { publishRecoveryStaging } from "../../services/project-recovery/publish-posix";

interface Publication {
  parent: string;
  identity: { dev: bigint; ino: bigint };
  from: string;
  to: string;
}
const checkName = (name: string) => {
  if (!name || name === "." || name === ".." || /[/\\\0]/.test(name))
    throw new Error("Managed publication requires one directory entry");
};
const checkParent = async (input: Publication) => {
  const found = await lstat(input.parent, { bigint: true });
  if (!found.isDirectory() || found.dev !== input.identity.dev || found.ino !== input.identity.ino)
    throw Object.assign(new Error("The managed folder parent moved during publication"), { code: "EXDEV" });
};

const publishWindows = async (input: Publication) => {
  const library = dlopen("kernel32.dll", {
    MoveFileExW: { args: ["ptr", "ptr", "u32"], returns: "int" },
    GetLastError: { args: [], returns: "u32" },
  });
  try {
    const source = await lstat(join(input.parent, input.from), { bigint: true });
    if (!source.isDirectory()) throw new Error("The managed staging directory changed");
    const from = Buffer.from(`${toNamespacedPath(join(input.parent, input.from))}\0`, "utf16le");
    const to = Buffer.from(`${toNamespacedPath(join(input.parent, input.to))}\0`, "utf16le");
    // WRITE_THROUGH; deliberately omit REPLACE_EXISTING and COPY_ALLOWED.
    if (!library.symbols.MoveFileExW(ptr(from), ptr(to), 8)) {
      const errno = library.symbols.GetLastError();
      const collision = await lstat(join(input.parent, input.to)).catch(() => null);
      throw Object.assign(new Error("Publishing the managed folder failed"), {
        code: collision ? "EEXIST" : "EIO",
        errno,
      });
    }
    await checkParent(input);
    const published = await lstat(join(input.parent, input.to), { bigint: true });
    if (!published.isDirectory() || published.dev !== source.dev || published.ino !== source.ino)
      throw new Error("The published managed directory changed; its files were retained");
  } finally {
    library.close();
  }
};
const publishMusl = async (input: Publication) => {
  const directory = await open(input.parent, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    const library = dlopen(`/lib/ld-musl-${process.arch === "arm64" ? "aarch64" : "x86_64"}.so.1`, {
      syscall: { args: ["i64", "int", "ptr", "int", "ptr", "u32"], returns: "i64" },
      __errno_location: { args: [], returns: "ptr" },
    });
    try {
      const held = await directory.stat({ bigint: true });
      if (held.dev !== input.identity.dev || held.ino !== input.identity.ino)
        throw Object.assign(new Error("The managed folder parent moved during publication"), { code: "EXDEV" });
      const from = Buffer.from(`${input.from}\0`);
      const to = Buffer.from(`${input.to}\0`);
      const errno = new DataView(toArrayBuffer(library.symbols.__errno_location()!, 0, 4));
      const result = library.symbols.syscall(
        process.arch === "arm64" ? 276n : 316n,
        directory.fd,
        ptr(from),
        directory.fd,
        ptr(to),
        1,
      );
      if (result !== 0n) {
        const value = errno.getInt32(0, true);
        throw Object.assign(new Error("Publishing the managed folder failed"), {
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

// The normal recovery policy remains unchanged. See ADR0159.
export const publishManagedFolder = async (input: Publication) => {
  checkName(input.from);
  checkName(input.to);
  if (supportsNativeRecovery()) return publishRecoveryStaging(input);
  await checkParent(input);
  if (process.platform === "win32") return publishWindows(input);
  if (process.platform === "linux" && ["x64", "arm64"].includes(process.arch)) return publishMusl(input);
  throw Object.assign(new Error("Exclusive folder publication is unavailable"), { code: "ENOTSUP" });
};
