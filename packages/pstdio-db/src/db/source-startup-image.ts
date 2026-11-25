import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

// PGlite caches code after instantiation. Concurrent cold opens otherwise compile it separately.
// Share only immutable code; each database still creates its own engine, memory and filesystem.
let sourceEngineModule: Promise<WebAssembly.Module> | undefined;
export const resolveSourceEngineModule = (wasmPath: string) =>
  (sourceEngineModule ??= Bun.file(wasmPath)
    .arrayBuffer()
    .then((bytes) => WebAssembly.compile(bytes))
    .catch((error) => {
      sourceEngineModule = undefined;
      throw error;
    }));

/** Source startup can reuse build output only for these exact generated migrations and engine. */
export const startupImageInputs = async (migrationsFolder: string) => {
  const require = createRequire(import.meta.url);
  const hash = createHash("sha256");
  for (const name of ["@electric-sql/pglite", "@electric-sql/pglite-icu-full"])
    hash.update(`${name}:${require(`${name}/package.json`).version}\n`);
  const input = (name: string, bytes: Uint8Array) => {
    hash.update(`${name}:${bytes.byteLength}:`);
    hash.update(bytes);
  };
  const journal = await readFile(join(migrationsFolder, "meta/_journal.json"));
  input("meta/_journal.json", journal);
  const { entries } = JSON.parse(journal.toString()) as { entries: { tag: string }[] };
  for (const { tag } of entries) {
    input(`${tag}.sql`, await readFile(join(migrationsFolder, `${tag}.sql`)));
    const postData = Bun.file(join(migrationsFolder, `${tag}.post-data.sql`));
    if (await postData.exists()) input(`${tag}.post-data.sql`, new Uint8Array(await postData.arrayBuffer()));
  }
  return hash.digest("hex");
};

export const startupImageManifest = async (image: Uint8Array, migrationsFolder: string) => ({
  inputs: await startupImageInputs(migrationsFolder),
  image: digest(image),
});

/** A stale or interrupted build is an optional cache miss. Keep validated bytes
 * immutable even if another build replaces the image before PGlite loads it. */
export const sourceStartupImage = async (imagePath: string, migrationsFolder: string, bareImage: Blob) => {
  try {
    const manifest = JSON.parse(await readFile(`${imagePath}.json`, "utf8"));
    if (manifest.inputs !== (await startupImageInputs(migrationsFolder))) return bareImage;
    const image = await readFile(imagePath);
    if (manifest.image !== digest(image)) return bareImage;
    return new Blob([image]);
  } catch {
    return bareImage;
  }
};

// Historical fixture builders keep resolvePgliteOptions' bare engine image.
// Only actual startup shares the generated, empty packaged schema image.
export const sourceStartupOptions = async <Options extends { loadDataDir: Blob; fsBundle?: Blob }>(
  options: Options,
) => {
  if (options.fsBundle) return options;
  return {
    ...options,
    loadDataDir: await sourceStartupImage(
      join(import.meta.dirname, "../../vendor/pglite/initial-database.tar.gz"),
      join(import.meta.dirname, "../../drizzle"),
      options.loadDataDir,
    ),
  };
};
