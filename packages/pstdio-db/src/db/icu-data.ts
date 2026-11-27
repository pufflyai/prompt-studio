import type { Extension, postgresMod } from "@electric-sql/pglite";

/** Install the bundled ICU common data as one immutable resource in each
 * engine's private filesystem. No device cache or locale selection is needed. */
export const fullIcuData = (asset: Blob): Extension => ({
  name: "fullIcuData",
  setup: async (_pg, opts) => {
    const data = Bun.zstdDecompressSync(new Uint8Array(await asset.arrayBuffer()));
    return {
      emscriptenOpts: {
        ...opts,
        preRun: [
          ...opts.preRun,
          (mod: postgresMod.PostgresMod) => {
            mod.FS.mkdirTree("/pglite/icu");
            mod.FS.mount(mod.FS.filesystems.MEMFS, {}, "/pglite/icu");
            mod.FS.writeFile("/pglite/icu/icudt76l.dat", data, { canOwn: true });
          },
        ],
      },
    };
  },
});
