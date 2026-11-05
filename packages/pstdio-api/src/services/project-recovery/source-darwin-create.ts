import { dlopen } from "bun:ffi";

/** Apple ARM64 places openat's variadic mode on the stack. Bun's fixed-signature
 * call needs the five unused register slots before that first stack argument.
 * Keep this ABI workaround private and removable; see ADR 0135. */
export const createDarwinRecoveryFileOpener = () => {
  if (process.platform !== "darwin" || process.arch !== "arm64") return undefined;
  const library = dlopen("/usr/lib/libSystem.B.dylib", {
    openat: { args: ["int", "ptr", "int", "int", "int", "int", "int", "int", "u32"], returns: "int" },
  });
  return {
    open: (parent: number, path: Parameters<typeof library.symbols.openat>[1], flags: number, mode: number) =>
      library.symbols.openat(parent, path, flags, 0, 0, 0, 0, 0, mode),
    close: library.close,
  };
};
