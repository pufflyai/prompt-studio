import type { CommandRunnerEnvironment } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";
import { openPublishedCatalog, publicationSchema } from "./catalog";
import { publishedRevisionOf, publishedSourceBaseline, sourceMatchesPublication } from "./source";
import { PublicationUpdateRequiredError } from "./types";

type Source = { version: string | null; source_ref: string | null; source_path: string };

/** Capture the invoking code, then re-read the shared version before each mutation. */
export const createPublicationStorageAccess = (
  deps: Pick<
    ExtensionsRouteDeps,
    "extensionService" | "extensionStorageService" | "assetTransferService" | "accountService"
  >,
  input: { projectId: string; extensionId: string; extensionInstanceId: string; source?: Source },
) => {
  let source = input.source;
  const getSource = async () =>
    (source ??= (await deps.extensionService.getProjectExtensionInstance(input.projectId, input.extensionInstanceId))
      ?.installedSource);
  const selection = async () => {
    const record = await (await openPublishedCatalog(deps, input.projectId)).read(input.extensionId);
    return record.value && !record.deleted ? { record, publication: publicationSchema.parse(record.value) } : null;
  };
  return {
    async write() {
      const selected = await selection();
      if (!selected) return;
      const invoking = await getSource();
      if (!invoking?.version || Bun.semver.order(invoking.version, selected.publication.version) < 0)
        throw new PublicationUpdateRequiredError();
      const revision = publishedRevisionOf(invoking.source_ref);
      if (revision && revision !== selected.publication.revision && selected.record.asset) {
        const baseline = await publishedSourceBaseline(
          deps,
          input.projectId,
          invoking.source_ref,
          selected.record.asset,
        );
        if (!baseline || (await sourceMatchesPublication(invoking.source_path, baseline)))
          throw new PublicationUpdateRequiredError();
      }
    },
    /** False while a local override must leave this migration to the synced version (R43). */
    async migrate() {
      // Without a published version every device runs its own copy, as in a local project.
      const selected = await selection();
      if (!selected) return true;
      const { cloudProjects, cloudProjectsLoaded } = await deps.accountService.status();
      if (cloudProjectsLoaded && !(cloudProjects as string[]).includes(input.projectId)) return true;
      const invoking = await getSource();
      if (
        !invoking ||
        publishedRevisionOf(invoking.source_ref) !== selected.publication.revision ||
        !selected.record.asset
      )
        return false;
      const baseline = await publishedSourceBaseline(deps, input.projectId, invoking.source_ref, selected.record.asset);
      return sourceMatchesPublication(invoking.source_path, baseline);
    },
  };
};

// Thrown inside a pending migration so its version is not recorded; the synced version still runs it.
const deferred = new Error("Migration deferred to the synced version");

export const guardPublicationStorage = (
  storage: CommandRunnerEnvironment["storage"],
  access: ReturnType<typeof createPublicationStorageAccess>,
) => {
  const guard = <T extends object>(api: T, writes: string[]) =>
    new Proxy(api, {
      get(target, key, receiver) {
        const value = Reflect.get(target, key, receiver);
        if (typeof value === "function" && typeof key === "string" && writes.includes(key))
          return async (...args: unknown[]) => {
            await access.write();
            return value.apply(target, args);
          };
        return value;
      },
    });
  return {
    ...guard(storage, ["set", "delete"]),
    // The access check runs only when a migration is due, after the stored version was read.
    migrate: async (version, run) => {
      try {
        await storage.migrate(version, async (...args) => {
          if (!(await access.migrate())) throw deferred;
          await run(...args);
        });
      } catch (error) {
        if (error !== deferred) throw error;
      }
    },
    records: guard(storage.records, ["commit", "resolve"]),
    files: guard(storage.files, ["put", "delete"]),
    assets: guard(storage.assets, ["stage", "cancel"]),
    collection: <TItem = unknown>(name: string) => {
      const collection = storage.collection<TItem>(name);
      return {
        ...guard(collection, ["put", "update", "create", "createIfAbsent", "delete", "deleteIfValue"]),
        attachments: (id: string) => guard(collection.attachments(id), ["put", "delete"]),
      };
    },
  } satisfies CommandRunnerEnvironment["storage"];
};
