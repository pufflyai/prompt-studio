import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { ensureDbDirectory, resolveDbPath } from "./paths";
import * as schema from "./schemas.pg";

// Bun embedded file imports for compiled binary — these become $bunfs paths
// @ts-expect-error Bun file import
import pgliteWasmPath from "../../node_modules/@electric-sql/pglite/dist/pglite.wasm" with { type: "file" };
// @ts-expect-error Bun file import
import pgliteDataPath from "../../node_modules/@electric-sql/pglite/dist/pglite.data" with { type: "file" };

type EmbeddedFile = Blob & { name: string };

const DRIZZLE_PREFIX = "../../pstdio-db/drizzle/";

const getEmbeddedFiles = (): EmbeddedFile[] => {
	try {
		const files = (Bun as Record<string, unknown>).embeddedFiles;
		if (Array.isArray(files)) return files as EmbeddedFile[];
	} catch {
		// not available
	}
	return [];
};

const isCompiledBinary = () => getEmbeddedFiles().length > 0;

const resolveMigrationsFolder = async () => {
	const embedded = getEmbeddedFiles().filter((f) => f.name.startsWith(DRIZZLE_PREFIX));

	if (embedded.length > 0) {
		const root = path.join(os.tmpdir(), "pstdio-drizzle");
		if (!fs.existsSync(path.join(root, "meta"))) {
			for (const file of embedded) {
				const relativePath = file.name.slice(DRIZZLE_PREFIX.length);
				const outPath = path.join(root, relativePath);
				fs.mkdirSync(path.dirname(outPath), { recursive: true });
				// @ts-expect-error Bun.write is not in @types/bun for all contexts
				await Bun.write(outPath, file);
			}
		}
		return root;
	}

	return path.join(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle");
};

const resolvePgliteOptions = async () => {
	if (!isCompiledBinary()) return {};

	const wasmBytes = await Bun.file(pgliteWasmPath).arrayBuffer();
	const wasmModule = await WebAssembly.compile(wasmBytes);
	const fsBundle = Bun.file(pgliteDataPath);

	return { fsBundle, wasmModule };
};

export const createDb = async (options?: { path?: string }) => {
	const dbPath = resolveDbPath(options?.path);

	ensureDbDirectory(dbPath);

	const pgliteOpts = await resolvePgliteOptions();
	const pglite = dbPath === ":memory:" ? new PGlite(pgliteOpts) : new PGlite(dbPath, pgliteOpts);

	const db = drizzle(pglite, { schema });
	const migrationsFolder = await resolveMigrationsFolder();
	if (fs.existsSync(migrationsFolder)) {
		await migrate(db, { migrationsFolder });
	}

	const close = async () => {
		await pglite.close();
	};

	return {
		close,
		db,
		path: dbPath,
		pglite,
	};
};

export type DbClient = PgliteDatabase<typeof schema>;
