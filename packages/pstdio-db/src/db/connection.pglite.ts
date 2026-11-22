import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PGlite } from "@electric-sql/pglite";
import { inArray } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { extensionIdentityRenames } from "pstdio-api-contracts/extension-host";
import { normalizeEmbeddedFileName, relativeEmbeddedFileName } from "pstdio-paths";
import type { StorageOwner } from "pstdio-sync";
import { migrateExtensionIdentities } from "../services/extension-identity-migration";
import { pruneAllDocumentFiles, pruneDocumentFiles } from "../services/extension-storage/document-file-retention";
import { attachDocumentCollector, documentFilesFor } from "../services/extension-storage/document-files";
import {
  attachIndexNodeFiles,
  createIndexNodeFiles,
  createMemoryIndexNodeFiles,
} from "../services/extension-storage/index-node-files";
import { upgradeIndexNodesToFiles } from "../services/extension-storage/index-node-upgrade";
import { pruneRecoveryFiles } from "../services/extension-storage/recovery-file-retention";
import { recoveryFilesFor } from "../services/extension-storage/recovery-files";
import { prepareAppPreferencesUpgrade } from "./app-preferences-upgrade";
import { restoreArtifactProjectionAdmission } from "./artifact-projection-admission";
import { prepareArtifactProjectionUpgrade } from "./artifact-projection-upgrade";
import { prepareAssetOwnerUpgrade } from "./asset-owner-upgrade";
import { prepareAutomationOwnersUpgrade } from "./automation-owners-upgrade";
import { prepareBoardDefaultsUpgrade } from "./board-defaults-upgrade";
import { prepareBoardOwnersUpgrade } from "./board-owners-upgrade";
import { prepareConnectionCredentialsUpgrade } from "./connection-credentials-upgrade";
import { attachDatabaseAuthority } from "./database-authority";
import { prepareDocumentOwnerUpgrade } from "./document-owner-upgrade";
import { prepareExtensionPreferencesUpgrade } from "./extension-preferences-upgrade";
import { prepareFileOwnersUpgrade } from "./file-owners-upgrade";
import { prepareHistoryOwnerUpgrade } from "./history-owner-upgrade";
import { retireLegacyRecordTables } from "./legacy-record-retirement";
import { type LegacyConversionFailure, upgradeLegacyRecords } from "./legacy-record-upgrade";
import { prepareLogOwnerUpgrade } from "./log-owner-upgrade";
import { migratePglite } from "./migrate-pglite";
import { prepareNativeOwnerUpgrade } from "./native-owner-upgrade";
import { openPglite } from "./open-pglite";
import { prepareOrderedOwnerUpgrade } from "./ordered-owner-upgrade";
import { prepareOwnerIndexUpgrade } from "./owner-index-upgrade";
import { prepareOwnerProjectionUpgrade } from "./owner-projection-upgrade";
import { canonicalDbPath, resolveDbPath } from "./paths";
import { type PgliteRetirementPhase, prepareCurrentPgliteHome } from "./pglite-current-home";
import { pgliteIdentity } from "./pglite-identity";
import { acquirePgliteLock } from "./pglite-lock";
import { prepareProjectExtensionsUpgrade } from "./project-extensions-upgrade";
import { prepareRecordRowFinalization } from "./record-row-upgrade";
import { prepareRecoveryOwnerUpgrade } from "./recovery-owner-upgrade";
import { prepareResourceLinkOwnerUpgrade } from "./resource-link-owner-upgrade";
import { prepareCanonicalNumberUpgrade } from "./resource-numbers-upgrade";
import { prepareResourcePrefixUpgrade } from "./resource-prefix-upgrade";
import { createRetiredStorageCleanup } from "./retired-storage-cleanup";
import * as schema from "./schemas.pg";
import { prepareSessionWorkspaceUpgrade } from "./session-workspace-upgrade";
import { type DatabaseMaintenancePhase, invalidateMaintenance, maintainDatabase } from "./startup-maintenance";
import { hasUpgradeSnapshots } from "./upgrade-snapshot";

type EmbeddedFile = Blob & { name: string };
// Bun's embedded file objects are runtime-specific; narrowing the contract keeps extraction testable
// without depending on full Blob behavior that unit tests do not control.
type EmbeddedMigrationFile = Pick<EmbeddedFile, "name" | "size" | "arrayBuffer">;

const DRIZZLE_EXTRACT_DIR = "pstdio-drizzle";
const PGLITE_WASM_SUFFIX = "/pstdio-db/vendor/pglite/pglite.wasm";
const PGLITE_DATA_SUFFIX = "/pstdio-db/vendor/pglite/pglite.data";
const PGLITE_INITIAL_DATABASE_SUFFIX = "/pstdio-db/vendor/pglite/initial-database.tar.gz";
const PGLITE_ICU_SUFFIX = "/pstdio-db/vendor/pglite/icu.76.tgz";

const getEmbeddedFiles = (): EmbeddedFile[] => {
  try {
    const files = (Bun as Record<string, unknown>).embeddedFiles;
    if (Array.isArray(files)) return files as EmbeddedFile[];
  } catch {
    // not available
  }
  return [];
};

const extractEmbeddedMigrations = async (
  embeddedFiles: readonly { file: EmbeddedMigrationFile; relativePath: string }[],
  root: string,
  logger: (message: string) => void,
) => {
  for (const { file, relativePath } of embeddedFiles) {
    const outPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    logger(`[drizzle] extracting ${relativePath} (${file.size} bytes)`);
    const buf = await file.arrayBuffer();
    fs.writeFileSync(outPath, Buffer.from(buf));
  }
};

export const resolveMigrationsFolder = async (
  options: {
    embeddedFiles?: readonly EmbeddedMigrationFile[];
    tmpDir?: string;
    logger?: (message: string) => void;
  } = {},
) => {
  const embeddedSource = options.embeddedFiles ?? getEmbeddedFiles();
  // Schema snapshots belong to migration generation; extracting them delays packaged startup.
  const embedded = embeddedSource.flatMap((file) => {
    const relativePath = relativeEmbeddedFileName(file.name, "pstdio-db/drizzle");
    return relativePath !== undefined && (relativePath.endsWith(".sql") || relativePath === "meta/_journal.json")
      ? [{ file, relativePath }]
      : [];
  });

  if (embedded.length > 0) {
    const root = fs.mkdtempSync(path.join(options.tmpDir ?? os.tmpdir(), `${DRIZZLE_EXTRACT_DIR}-`));
    const dispose = () => fs.rmSync(root, { recursive: true, force: true });
    try {
      await extractEmbeddedMigrations(embedded, root, options.logger ?? console.log);
      return { path: root, dispose };
    } catch (error) {
      dispose();
      throw error;
    }
  }

  return {
    path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle"),
    dispose: () => {},
  };
};

const withMigrationsFolder = async (run: (folder: string) => Promise<void>) => {
  const migrations = await resolveMigrationsFolder();
  try {
    await run(migrations.path);
  } finally {
    migrations.dispose();
  }
};

// PGlite caches code after instantiation. Concurrent cold opens otherwise compile it separately.
// Share only immutable code; each database still creates its own engine, memory and filesystem.
let sourceEngineModule: Promise<WebAssembly.Module> | undefined;
const resolveSourceEngineModule = (wasmPath: string) =>
  (sourceEngineModule ??= Bun.file(wasmPath)
    .arrayBuffer()
    .then((bytes) => WebAssembly.compile(bytes))
    .catch((error) => {
      sourceEngineModule = undefined;
      throw error;
    }));

export const resolvePgliteOptions = async (embeddedFiles: readonly EmbeddedFile[] = getEmbeddedFiles()) => {
  const wasmFile = embeddedFiles.find((file) => normalizeEmbeddedFileName(file.name).endsWith(PGLITE_WASM_SUFFIX));
  const dataFile = embeddedFiles.find((file) => normalizeEmbeddedFileName(file.name).endsWith(PGLITE_DATA_SUFFIX));
  const initialDatabase = embeddedFiles.find((file) =>
    normalizeEmbeddedFileName(file.name).endsWith(PGLITE_INITIAL_DATABASE_SUFFIX),
  );
  const icu = embeddedFiles.find((file) => normalizeEmbeddedFileName(file.name).endsWith(PGLITE_ICU_SUFFIX));
  if (!wasmFile && !dataFile && !initialDatabase && !icu) {
    const require = createRequire(import.meta.url);
    const icuPath = path.join(path.dirname(require.resolve("@electric-sql/pglite-icu-full")), "icu.76.tgz");
    const enginePath = path.join(
      path.dirname(require.resolve("@electric-sql/pglite/package.json")),
      "dist/pglite.wasm",
    );
    return {
      ...pgliteIdentity,
      pgliteWasmModule: await resolveSourceEngineModule(enginePath),
      icuDataDir: Bun.file(icuPath),
      loadDataDir: Bun.file(path.join(import.meta.dirname, "../../vendor/pglite/empty-database.tar.gz")),
    };
  }
  if (!wasmFile || !dataFile || !initialDatabase || !icu) {
    throw new Error(
      "Partial PGlite embed: expected the WebAssembly module, filesystem bundle, full ICU data and initial database image.",
    );
  }

  const wasmBytes = await wasmFile.arrayBuffer();
  const wasmModule = await WebAssembly.compile(wasmBytes);

  return {
    ...pgliteIdentity,
    fsBundle: dataFile,
    pgliteWasmModule: wasmModule,
    loadDataDir: initialDatabase,
    icuDataDir: icu,
  };
};

// Startup steps in order. The runtime publishes itself once the database is locked and logs every step.
export type DbOpenPhase =
  | PgliteRetirementPhase
  | DatabaseMaintenancePhase
  | "database_locked"
  | "database_engine_loaded"
  | "database_image_restored"
  | "database_opened"
  | "database_migrated"
  | "database_index_nodes";

export const createDb = async (options?: {
  path?: string;
  onPhase?: (phase: DbOpenPhase) => void;
  signal?: AbortSignal;
  /** Folder for encrypted index nodes; defaults to a sibling of the database folder. */
  indexNodesPath?: string;
  onLegacyConversionError?: (failure: LegacyConversionFailure) => void;
  /** The runtime vacuums in the background and schedules deletion of retired rows. */
  deferCleanup?: boolean;
}) => {
  const onPhase = options?.onPhase ?? (() => {});
  const requestedPath = resolveDbPath(options?.path);
  const dbPath = canonicalDbPath(requestedPath);

  const releaseLock = dbPath === ":memory:" ? () => {} : acquirePgliteLock(dbPath);

  let pglite: PGlite | undefined;
  let fresh = dbPath === ":memory:";
  const onImageRestored = () => {
    fresh = true;
    onPhase("database_image_restored");
  };
  try {
    onPhase("database_locked");
    options?.signal?.throwIfAborted();
    const embedded = getEmbeddedFiles();
    const pgliteOpts = await resolvePgliteOptions(embedded);
    onPhase("database_engine_loaded");
    if (dbPath !== ":memory:")
      await prepareCurrentPgliteHome({
        activePath: dbPath,
        runtime: pgliteOpts,
        embedded,
        signal: options?.signal,
        onImageRestored,
        onPhase,
      });
    options?.signal?.throwIfAborted();
    pglite = await openPglite(dbPath, pgliteOpts, onImageRestored);
    const openedPglite = pglite;
    await openedPglite.waitReady;
    onPhase("database_opened");

    const db = drizzle(openedPglite, { schema });
    attachDatabaseAuthority(db, dbPath);
    recoveryFilesFor(db, dbPath);
    documentFilesFor(db, dbPath);
    attachDocumentCollector(db, (projectId, ids) => pruneDocumentFiles(db, projectId, ids));
    // The node folder belongs to this database, so another database can never clean it up.
    const indexNodes =
      dbPath === ":memory:"
        ? createMemoryIndexNodeFiles()
        : createIndexNodeFiles(options?.indexNodesPath ?? `${dbPath}-index-nodes`);
    attachIndexNodeFiles(db, indexNodes);
    let migrated = false;
    let finishArtifactProjectionUpgrade: (() => Promise<void>) | undefined;
    await withMigrationsFolder(async (migrationsFolder) => {
      if (!fs.existsSync(migrationsFolder)) return;
      // An empty engine has no released tables. Durable conversion inputs may
      // still exist beside a restored image, so those must resume normally.
      if (fresh && !(await hasUpgradeSnapshots(dbPath))) {
        await migratePglite(openedPglite, migrationsFolder);
        await retireLegacyRecordTables(db, migrationsFolder);
        migrated = true;
        return;
      }
      const finishRecordRows = await prepareRecordRowFinalization(db, dbPath);
      const finishProjectExtensionsUpgrade = await prepareProjectExtensionsUpgrade(db, dbPath);
      const finishResourceLinkOwnerUpgrade = await prepareResourceLinkOwnerUpgrade(db, dbPath);
      const finishResourcePrefixUpgrade = await prepareResourcePrefixUpgrade(db, dbPath);
      const finishOwnerIndexUpgrade = await prepareOwnerIndexUpgrade(db, dbPath);
      const finishOwnerProjectionUpgrade = await prepareOwnerProjectionUpgrade(db, dbPath);
      const finishCanonicalNumberUpgrade = await prepareCanonicalNumberUpgrade(db, dbPath);
      const finishDocumentOwnerUpgrade = await prepareDocumentOwnerUpgrade(db, dbPath);
      finishArtifactProjectionUpgrade = await prepareArtifactProjectionUpgrade(db, dbPath);
      const finishNativeOwnerUpgrade = await prepareNativeOwnerUpgrade(db, dbPath);
      const finishRecoveryOwnerUpgrade = await prepareRecoveryOwnerUpgrade(db, dbPath);
      const finishOrderedOwnerUpgrade = await prepareOrderedOwnerUpgrade(db, dbPath);
      const finishAssetOwnerUpgrade = await prepareAssetOwnerUpgrade(db, dbPath);
      const finishHistoryOwnerUpgrade = await prepareHistoryOwnerUpgrade(db, dbPath);
      const finishLogOwnerUpgrade = await prepareLogOwnerUpgrade(db, dbPath);
      const finishFileOwnersUpgrade = await prepareFileOwnersUpgrade(db, dbPath);
      const finishPreferencesUpgrade = await prepareAppPreferencesUpgrade(db, dbPath);
      const finishExtensionPreferencesUpgrade = await prepareExtensionPreferencesUpgrade(db, dbPath);
      const finishConnectionCredentialsUpgrade = await prepareConnectionCredentialsUpgrade(db, dbPath);
      const finishBoardOwnersUpgrade = await prepareBoardOwnersUpgrade(db, dbPath);
      const finishBoardDefaultsUpgrade = await prepareBoardDefaultsUpgrade(db, dbPath);
      const finishAutomationOwnersUpgrade = await prepareAutomationOwnersUpgrade(db, dbPath);
      const finishSessionWorkspaceUpgrade = await prepareSessionWorkspaceUpgrade(db, dbPath);
      await migratePglite(openedPglite, migrationsFolder);
      await finishProjectExtensionsUpgrade?.();
      await finishLogOwnerUpgrade?.();
      await finishHistoryOwnerUpgrade?.();
      await finishAssetOwnerUpgrade?.();
      await finishOrderedOwnerUpgrade?.();
      await finishRecoveryOwnerUpgrade?.();
      await finishDocumentOwnerUpgrade?.();
      await finishNativeOwnerUpgrade?.();
      await finishCanonicalNumberUpgrade?.();
      await finishOwnerProjectionUpgrade?.();
      await finishOwnerIndexUpgrade?.();
      await finishPreferencesUpgrade?.();
      await finishExtensionPreferencesUpgrade?.();
      await finishConnectionCredentialsUpgrade?.();
      await finishBoardOwnersUpgrade?.();
      await finishBoardDefaultsUpgrade?.();
      await finishAutomationOwnersUpgrade?.();
      await finishResourceLinkOwnerUpgrade?.();
      await finishResourcePrefixUpgrade?.();
      await finishSessionWorkspaceUpgrade?.();
      await finishFileOwnersUpgrade();
      if (await upgradeLegacyRecords(db, dbPath, { signal: options?.signal, failed: options?.onLegacyConversionError }))
        await retireLegacyRecordTables(db, migrationsFolder);
      await finishRecordRows?.();
      migrated = true;
    });
    // Copy durable receipts before opening. Remove old rows for both sides of an identity
    // rename now so the rename does not copy cache data or see a false conflict.
    await pruneRecoveryFiles(db);
    onPhase("database_index_nodes");
    // A run that stops after deleting rows must leave offline space reclamation pending.
    const owed = () => invalidateMaintenance(dbPath);
    const deferredOwners: StorageOwner[] = [];
    const deferCleanup = options?.deferCleanup && dbPath !== ":memory:";
    const renamedOwners = new Set(
      extensionIdentityRenames.flatMap(({ from, to }) => [
        `${from.publisher}.${from.name}`,
        `${to.publisher}.${to.name}`,
      ]),
    );
    const movedNodes = await upgradeIndexNodesToFiles(db, indexNodes, undefined, owed, (owner) => {
      if (!deferCleanup || renamedOwners.has(owner.extensionId)) return false;
      deferredOwners.push(owner);
      return true;
    });
    const renamed = await migrateExtensionIdentities(db, {
      beforeChange: owed,
      onConflict: async (error) => {
        await db
          .update(schema.installed_extension_sources)
          .set({ status: "error", last_error_json: { code: error.code, message: error.message } })
          .where(inArray(schema.installed_extension_sources.extension_id, [error.from, error.to]));
      },
    });
    await finishArtifactProjectionUpgrade?.();
    await restoreArtifactProjectionAdmission(db, dbPath);
    await pruneAllDocumentFiles(db);
    if (migrated && !deferCleanup)
      await maintainDatabase(openedPglite, db, dbPath, fresh, onPhase, movedNodes || renamed);
    const projectIds = await db.select({ id: schema.projects.id }).from(schema.projects);
    await indexNodes.retainProjects(new Set(projectIds.map((project) => project.id)));
    onPhase("database_migrated");

    let closed = false;
    const close = async () => {
      if (closed) {
        return;
      }

      closed = true;
      try {
        await openedPglite.close();
      } finally {
        releaseLock();
      }
    };

    return {
      close,
      db,
      path: dbPath,
      pglite: openedPglite,
      cleanupRetiredRows: deferCleanup ? createRetiredStorageCleanup(db, dbPath, deferredOwners) : async () => {},
    };
  } catch (error) {
    await pglite?.close();
    releaseLock();
    throw error;
  }
};

export type DbClient = PgliteDatabase<typeof schema>;
