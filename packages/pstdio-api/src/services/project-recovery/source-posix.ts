import { dlopen, ptr, toArrayBuffer } from "bun:ffi";
import { type BigIntStats, constants, fstat, read } from "node:fs";
import { open, realpath, unlink } from "node:fs/promises";
import { join } from "node:path";
import { getSystemErrorName } from "node:util";
import { supportsNativeRecovery } from "./platform";

const component = (name: string) => {
  if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\0"))
    throw new Error("Recovery source access requires one directory entry");
  return Buffer.from(`${name}\0`);
};
const stat = (fd: number) =>
  new Promise<BigIntStats>((resolve, reject) =>
    fstat(fd, { bigint: true }, (error, value) => (error ? reject(error) : resolve(value))),
  );
const sameIdentity = (before: BigIntStats, after: BigIntStats) => before.dev === after.dev && before.ino === after.ino;

/** Private held-directory access. See ADR 0138. A path is never reconstructed for
 * child reads; swapping a parent pathname cannot redirect the selected handle. */
export const openRecoverySource = async (selected: string) => {
  if (!supportsNativeRecovery())
    throw Object.assign(new Error("Recovery requires a qualified native source adapter for this platform"), {
      code: "ENOTSUP",
    });
  const darwin = process.platform === "darwin";
  const load = () =>
    dlopen(darwin ? "/usr/lib/libSystem.B.dylib" : "libc.so.6", {
      openat: { args: ["int", "ptr", "int"], returns: "int" },
      linkat: { args: ["int", "ptr", "int", "ptr", "int"], returns: "int" },
      close: { args: ["int"], returns: "int" },
      fdopendir: { args: ["int"], returns: "ptr" },
      readdir: { args: ["ptr"], returns: "ptr" },
      closedir: { args: ["ptr"], returns: "int" },
      readlinkat: { args: ["int", "ptr", "ptr", "u64"], returns: "i64" },
      [darwin ? "__error" : "__errno_location"]: { args: [], returns: "ptr" },
    });
  let library: ReturnType<typeof load>;
  try {
    library = load();
  } catch (cause) {
    throw Object.assign(new Error("This system's C library is not supported for folder recovery"), {
      code: "ENOTSUP",
      cause,
    });
  }
  const native = library.symbols;
  const handles = new Set<number>();
  const streams = new Set<NonNullable<ReturnType<typeof native.fdopendir>>>();
  const errno = new DataView(toArrayBuffer(native[darwin ? "__error" : "__errno_location"]!()!, 0, 4));
  const failure = () => {
    const value = errno.getInt32(0, true);
    return Object.assign(new Error("Recovery source filesystem access failed"), {
      errno: value,
      code: value > 0 ? getSystemErrorName(-value) : "EIO",
    });
  };
  const common = (darwin ? 0x1000000 : 0x80000) | constants.O_NONBLOCK;
  const metadata = darwin ? 0x8000 | 0x200000 : 0x200000;
  let closed = false;
  const ensureOpen = () => {
    if (closed) throw new Error("Recovery source access is closed");
  };
  const closeFd = (fd: number) => {
    if (!handles.delete(fd)) return;
    if (native.close(fd) !== 0) throw failure();
  };
  const openAt = (parent: number, name: Buffer, flags: number) => {
    ensureOpen();
    // Darwin's O_SYMLINK opens the link itself; combining O_NOFOLLOW rejects it.
    const nofollow = darwin && flags & 0x200000 ? 0 : constants.O_NOFOLLOW;
    const combined = common | nofollow | flags;
    const fd = native.openat(parent, ptr(name), combined);
    if (fd < 0) throw failure();
    handles.add(fd);
    return fd;
  };
  const nextName = (directory: NonNullable<ReturnType<typeof native.fdopendir>>) => {
    errno.setInt32(0, 0, true);
    const entry = native.readdir(directory);
    if (!entry) {
      if (errno.getInt32(0, true)) throw failure();
      return null;
    }
    const header = new DataView(toArrayBuffer(entry, 0, 21));
    const length = header.getUint16(16, true);
    const offset = darwin ? 21 : 19;
    if (length <= offset || length > 64 * 1024) throw new Error("Invalid native recovery directory entry");
    const bytes = new Uint8Array(toArrayBuffer(entry, offset, length - offset));
    const end = bytes.indexOf(0);
    if (end < 0) throw new Error("Unterminated native recovery directory entry");
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, end));
  };
  const closeDirectory = (directory: NonNullable<ReturnType<typeof native.fdopendir>>) => {
    if (streams.delete(directory) && native.closedir(directory) !== 0) throw failure();
  };
  const handle = (fd: number) => {
    let ended = false;
    const active = () => {
      ensureOpen();
      if (ended || !handles.has(fd)) throw new Error("Recovery source handle is closed");
    };
    return {
      async create(name: string, bytes: Uint8Array, stagingRoot: string) {
        active();
        const target = component(name);
        const temporary = join(stagingRoot, `${crypto.randomUUID()}.policy-pending`);
        const prepared = await open(temporary, "wx", 0o600);
        try {
          await prepared.writeFile(bytes);
          await prepared.sync();
          active();
          // Linking a complete file refuses an existing destination atomically.
          // EXDEV blocks setup; there is no direct-write fallback.
          if (native.linkat(darwin ? -2 : -100, ptr(Buffer.from(`${temporary}\0`)), fd, ptr(target), 0) !== 0)
            throw failure();
        } finally {
          await prepared.close();
          await unlink(temporary);
        }
      },
      stat: async () => {
        active();
        return stat(fd);
      },
      async open(name: string, readable = false) {
        active();
        const bytes = component(name);
        const inspected = openAt(fd, bytes, metadata);
        if (!readable) return handle(inspected);
        let opened: number | undefined;
        try {
          const before = await stat(inspected);
          if (!before.isFile() && !before.isDirectory())
            throw new Error("This recovery entry cannot be opened for reading");
          opened = openAt(fd, bytes, constants.O_RDONLY | (before.isDirectory() ? constants.O_DIRECTORY : 0));
          const after = await stat(opened);
          if (!sameIdentity(before, after) || before.mode !== after.mode)
            throw new Error("Recovery source changed before reading");
          const result = handle(opened);
          opened = undefined;
          return result;
        } finally {
          closeFd(inspected);
          if (opened !== undefined) closeFd(opened);
        }
      },
      read(bytes: Uint8Array, position: number) {
        active();
        return new Promise<number>((resolve, reject) =>
          read(fd, bytes, 0, bytes.length, position, (error, count) => (error ? reject(error) : resolve(count))),
        );
      },
      readlink(name: string) {
        active();
        const bytes = new Uint8Array(16 * 1024);
        const length = Number(native.readlinkat(fd, ptr(component(name)), ptr(bytes), bytes.length));
        if (length < 0) throw failure();
        if (length === bytes.length) throw new Error("Recovery link target exceeds the supported bound");
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length));
      },
      *children() {
        active();
        const child = openAt(fd, Buffer.from(".\0"), constants.O_RDONLY | constants.O_DIRECTORY);
        const directory = native.fdopendir(child);
        if (!directory) {
          closeFd(child);
          throw failure();
        }
        handles.delete(child); // fdopendir owns this independent directory descriptor.
        streams.add(directory);
        try {
          while (true) {
            active();
            const name = nextName(directory);
            if (name === null) return;
            if (name !== "." && name !== "..") {
              component(name);
              yield name;
            }
          }
        } finally {
          closeDirectory(directory);
        }
      },
      close() {
        if (!ended) {
          ended = true;
          closeFd(fd);
        }
      },
    };
  };
  const close = () => {
    if (closed) return;
    closed = true;
    try {
      for (const stream of streams) native.closedir(stream);
      streams.clear();
      for (const fd of [...handles]) closeFd(fd);
    } finally {
      library.close();
    }
  };
  try {
    // Root selection resolves the registered root once. Every resulting absolute
    // component is then opened from a held parent with no-follow semantics.
    const rootPath = await realpath(selected);
    let root = openAt(darwin ? -2 : -100, Buffer.from("/\0"), constants.O_RDONLY | constants.O_DIRECTORY);
    for (const part of rootPath.split("/").filter(Boolean)) {
      const next = openAt(root, component(part), constants.O_RDONLY | constants.O_DIRECTORY);
      closeFd(root);
      root = next;
    }
    return { root: handle(root), rootPath, close };
  } catch (error) {
    close();
    throw error;
  }
};

export type RecoverySourceHandle = Awaited<ReturnType<typeof openRecoverySource>>["root"];
