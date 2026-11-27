import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { inArray } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { extensionIdentityRenames } from "pstdio-api-contracts/extension-host";
import { normalizeEmbeddedFileName } from "pstdio-paths";
import type { StorageOwner } from "pstdio-sync";
import { migrateExtensionIdentities } from "../services/extension-identity-migration";
import { pruneDocumentFiles } from "../services/extension-storage/document-file-retention";
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
import {
  captureToolUpgradeSources,
  finishReleasedBaseline,
  hasReleasedJournal,
  verifyReleasedJournal,
} from "./baseline-0-49";
import { importBatchOwners, importBatchRows, stageBatchReimport } from "./batch-reimport";
import { batchBackup, batchPayload, recoverBatchHome } from "./batch-reimport-home";
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
import { finishLocalUpgrade } from "./local-upgrade-state";
import { prepareLogOwnerUpgrade } from "./log-owner-upgrade";
import { migratePglite, resumeCurrentPgliteSchema } from "./migrate-pglite";
import { type EmbeddedFile, getEmbeddedFiles, withMigrationsFolder } from "./migration-assets";
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
import { prepareReleasedSaveReceipts } from "./released-save-receipts";
import { prepareResourceLinkOwnerUpgrade } from "./resource-link-owner-upgrade";
import { prepareCanonicalNumberUpgrade } from "./resource-numbers-upgrade";
import { prepareResourcePrefixUpgrade } from "./resource-prefix-upgrade";
import { createStorageCleanup } from "./retired-storage-cleanup";
import * as schema from "./schemas.pg";
import { prepareSessionWorkspaceUpgrade } from "./session-workspace-upgrade";
import { resolveSourceEngineModule, sourceStartupOptions } from "./source-startup-image";
import { type DatabaseMaintenancePhase, invalidateMaintenance, maintainDatabase } from "./startup-maintenance";

export { resolveMigrationsFolder } from "./migration-assets";

const PGLITE_WASM_SUFFIX = "/pstdio-db/vendor/pglite/pglite.wasm";
const PGLITE_DATA_SUFFIX = "/pstdio-db/vendor/pglite/pglite.data";
const PGLITE_INITIAL_DATABASE_SUFFIX = "/pstdio-db/vendor/pglite/initial-database.tar.gz";
const PGLITE_ICU_SUFFIX = "/pstdio-db/vendor/pglite/icu.76.tgz";

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
  | "database_released_upgrade"
  | "database_opened"
  | "database_migrated"
  | "database_index_nodes";

const createDatabaseCloser = (db: { close(): Promise<void> }, cleanup: () => Promise<void>, releaseLock: () => void) => {
  let closed = false;
  return async () => {
    if (closed) return;

    closed = true;
    try {
      await cleanup().finally(() => db.close());
    } finally {
      releaseLock();
    }
  };
};

export const createDb = async (options?: {
  path?: string;
  onPhase?: (phase: DbOpenPhase) => void;
  signal?: AbortSignal;
  /** Folder for encrypted index nodes; defaults to a sibling of the database folder. */
  indexNodesPath?: string;
  storageRoot?: string;
  onLegacyConversionError?: (failure: LegacyConversionFailure) => void;
  /** The runtime vacuums in the background and schedules deletion of retired rows. */
  deferCleanup?: boolean;
}) => {
  const onPhase = options?.onPhase ?? (() => {});
  const dbPath = canonicalDbPath(resolveDbPath(options?.path));

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
    const pgliteOpts = await sourceStartupOptions(await resolvePgliteOptions(embedded));
    onPhase("database_engine_loaded");
    if (dbPath !== ":memory:") {
      await recoverBatchHome(dbPath);
      await prepareCurrentPgliteHome({
        activePath: dbPath,
        runtime: pgliteOpts,
        embedded,
        signal: options?.signal,
        onImageRestored,
        onPhase,
      });
    }
    options?.signal?.throwIfAborted();
    pglite = await openPglite(dbPath, pgliteOpts, onImageRestored);
    await pglite.waitReady;
    const releasedJournal = await hasReleasedJournal(pglite);
    if (releasedJournal && !fresh && dbPath !== ":memory:") onPhase("database_released_upgrade");
    if (releasedJournal && !fresh && dbPath !== ":memory:" && !fs.existsSync(batchBackup(dbPath))) {
      const source = pglite;
      let staged = false;
      await withMigrationsFolder(async (folder) => {
        staged = await stageBatchReimport(source, dbPath, pgliteOpts, folder, options?.signal, options?.storageRoot);
      }, true);
      if (staged) {
        await source.close();
        pglite = undefined;
        await recoverBatchHome(dbPath);
        pglite = await openPglite(dbPath, pgliteOpts);
        await pglite.waitReady;
      }
    }
    const openedPglite = pglite;
    const payload = path.join(dbPath, batchPayload);
    const reimport = dbPath !== ":memory:" && fs.existsSync(payload);
    onPhase("database_opened");

    const db = drizzle(openedPglite, { schema });
    attachDatabaseAuthority(db, dbPath);
    recoveryFilesFor(db, dbPath);
    documentFilesFor(db, dbPath);
    // The node folder belongs to this database, so another database can never clean it up.
    const indexNodes =
      dbPath === ":memory:"
        ? createMemoryIndexNodeFiles()
        : createIndexNodeFiles(options?.indexNodesPath ?? `${dbPath}-index-nodes`);
    attachIndexNodeFiles(db, indexNodes);
    const finishLocal = () =>
      finishLocalUpgrade(db, openedPglite, options?.storageRoot ?? path.join(path.dirname(dbPath), "storage"));
    let migrated = false;
    let finishArtifactProjectionUpgrade: (() => Promise<void>) | undefined;
    await withMigrationsFolder(async (migrationsFolder) => {
      if (!fs.existsSync(migrationsFolder)) return;
      const prefix = releasedJournal ? (await verifyReleasedJournal(openedPglite, migrationsFolder)).applied : 0;
      const finishLegacyAdmission = async () => {
        if (
          await upgradeLegacyRecords(db, dbPath, { signal: options?.signal, failed: options?.onLegacyConversionError })
        )
          await retireLegacyRecordTables(openedPglite, migrationsFolder);
      };
      if (
        !reimport &&
        (await resumeCurrentPgliteSchema({
          engine: openedPglite,
          migrationsFolder,
          path: dbPath,
          fresh,
          finishLegacyAdmission,
        }))
      ) {
        if (releasedJournal) await finishReleasedBaseline(openedPglite, dbPath, migrationsFolder, finishLocal);
        migrated = true;
        return;
      }
      const localUpgrade = prefix >= 8 && prefix <= 11;
      const receipts = await prepareReleasedSaveReceipts(db, dbPath, localUpgrade);
      const finishRecordRows = await prepareRecordRowFinalization(db, dbPath);
      const finishProjectExtensionsUpgrade = await prepareProjectExtensionsUpgrade(db, dbPath);
      const finishResourceLinkOwnerUpgrade = await prepareResourceLinkOwnerUpgrade(db, dbPath);
      const finishResourcePrefixUpgrade = await prepareResourcePrefixUpgrade(db, dbPath);
      const finishOwnerIndexUpgrade = await prepareOwnerIndexUpgrade(db, dbPath);
      const finishOwnerProjectionUpgrade = await prepareOwnerProjectionUpgrade(db, dbPath);
      const finishCanonicalNumberUpgrade = await prepareCanonicalNumberUpgrade(db, dbPath);
      const finishDocumentOwnerUpgrade = await prepareDocumentOwnerUpgrade(db, dbPath, receipts);
      finishArtifactProjectionUpgrade = await prepareArtifactProjectionUpgrade(db, dbPath);
      const finishNativeOwnerUpgrade = await prepareNativeOwnerUpgrade(db, dbPath);
      const finishRecoveryOwnerUpgrade = await prepareRecoveryOwnerUpgrade(db, dbPath);
      const finishOrderedOwnerUpgrade = await prepareOrderedOwnerUpgrade(db, dbPath, receipts);
      const finishAssetOwnerUpgrade = await prepareAssetOwnerUpgrade(db, dbPath);
      const finishHistoryOwnerUpgrade = await prepareHistoryOwnerUpgrade(db, dbPath, localUpgrade);
      const finishLogOwnerUpgrade = await prepareLogOwnerUpgrade(db, dbPath);
      const finishFileOwnersUpgrade = await prepareFileOwnersUpgrade(db, dbPath);
      const finishPreferencesUpgrade = await prepareAppPreferencesUpgrade(db, dbPath);
      const finishExtensionPreferencesUpgrade = await prepareExtensionPreferencesUpgrade(db, dbPath);
      const finishConnectionCredentialsUpgrade = await prepareConnectionCredentialsUpgrade(db, dbPath);
      const finishBoardOwnersUpgrade = await prepareBoardOwnersUpgrade(db, dbPath);
      const finishBoardDefaultsUpgrade = await prepareBoardDefaultsUpgrade(db, dbPath);
      const finishAutomationOwnersUpgrade = await prepareAutomationOwnersUpgrade(db, dbPath);
      const finishSessionWorkspaceUpgrade = await prepareSessionWorkspaceUpgrade(db, dbPath);
      await migratePglite(openedPglite, migrationsFolder, async (tx) => {
        if (reimport) await importBatchOwners(tx);
        if (localUpgrade) await tx.exec("CREATE SCHEMA pstdio_local_upgrade_049");
        // Every supported source crossing the 0.49 schema can have tools built against an older API.
        await captureToolUpgradeSources(tx);
      });
      await finishProjectExtensionsUpgrade?.();
      await finishLogOwnerUpgrade?.();
      await finishHistoryOwnerUpgrade?.();
      await finishAssetOwnerUpgrade?.();
      await finishOrderedOwnerUpgrade?.();
      await finishRecoveryOwnerUpgrade?.();
      await finishDocumentOwnerUpgrade?.();
      await receipts?.complete();
      await finishNativeOwnerUpgrade?.();
      await finishCanonicalNumberUpgrade?.();
      await finishOwnerProjectionUpgrade?.();
      await finishOwnerIndexUpgrade?.();
      if (reimport) await importBatchRows(openedPglite);
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
      await finishLegacyAdmission();
      await finishRecordRows?.();
      if (releasedJournal) await finishReleasedBaseline(openedPglite, dbPath, migrationsFolder, finishLocal);
      migrated = true;
    }, releasedJournal);
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
    const cleanup = createStorageCleanup(db, dbPath, deferredOwners, !!deferCleanup);
    await cleanup.prepare();
    attachDocumentCollector(db, (projectId, ids) => pruneDocumentFiles(db, projectId, ids));
    if (migrated && !deferCleanup)
      await maintainDatabase(openedPglite, db, dbPath, fresh, onPhase, movedNodes || renamed);
    const projectIds = await db.select({ id: schema.projects.id }).from(schema.projects);
    await indexNodes.retainProjects(new Set(projectIds.map((project) => project.id)));
    if (reimport) await fs.promises.rm(payload, { recursive: true, force: true });
    onPhase("database_migrated");

    return {
      close: createDatabaseCloser(openedPglite, () => cleanup.close(), releaseLock),
      db,
      path: dbPath,
      pglite: openedPglite,
      cleanupRetiredRows: cleanup.run,
    };
  } catch (error) {
    await pglite?.close();
    releaseLock();
    throw error;
  }
};

export type DbClient = PgliteDatabase<typeof schema>;
