import type { StorageLogDefinition, StorageLogRead } from "pstdio-sync-contracts";
import { decodeText, encodeText } from "../shared";
import { logPageLimit } from "./log-cursor";
import { followLogPages } from "./log-follow";
import type { createLogStreamSync } from "./log-sync";
import type { LogEntryMetadata, LogReadPlan, LogStreamStore } from "./log-types";

export interface LogDirectoryEntry extends StorageLogDefinition {
  scope: string;
  stream: string;
}
export type LogRemote = Pick<ReturnType<typeof createLogStreamSync>, "publish" | "read" | "compact" | "plan">;
interface CollectionInput {
  address: string;
  definition: StorageLogDefinition;
  scope: string;
  writerId(): Promise<string>;
  directory(): Promise<LogDirectoryEntry[]>;
  register(entry: LogDirectoryEntry): Promise<void>;
  open(entry: LogDirectoryEntry): Promise<LogStreamStore>;
  remote(entry: LogDirectoryEntry, store: LogStreamStore): Promise<LogRemote | undefined>;
  watch(listener: () => void): () => unknown;
}
const decodeCursor = (address: string, cursor: StorageLogRead["after"]) => {
  if (cursor === undefined || cursor === 0) return {} as Record<string, string>;
  const value = JSON.parse(decodeText(cursor));
  if (
    !value ||
    value.version !== 1 ||
    value.address !== address ||
    !value.positions ||
    typeof value.positions !== "object" ||
    Array.isArray(value.positions) ||
    Object.values(value.positions).some((item) => typeof item !== "string")
  )
    throw new Error("Invalid device-log cursor");
  return value.positions as Record<string, string>;
};
const cursorAt = (positions: Record<string, string>, stream: string) =>
  Object.hasOwn(positions, stream) ? positions[stream]! : (0 as const);
const mergedEntries = (pages: { stream: string; page: LogReadPlan }[], limit: number, newest: boolean) => {
  const used = new Map<string, number>();
  const entries: { stream: string; entry: LogEntryMetadata }[] = [];
  while (entries.length < limit) {
    const candidates = pages
      .flatMap(({ stream, page }) => {
        const count = used.get(stream) ?? 0;
        const index = newest ? page.entries.length - 1 - count : count;
        const entry = page.entries[index];
        return entry ? [{ stream, entry }] : [];
      })
      .sort((a, b) => {
        const order =
          a.entry.createdAt.localeCompare(b.entry.createdAt) ||
          a.stream.localeCompare(b.stream) ||
          a.entry.id.localeCompare(b.entry.id);
        return newest ? -order : order;
      });
    const next = candidates[0];
    if (!next) break;
    used.set(next.stream, (used.get(next.stream) ?? 0) + 1);
    entries.push(next);
  }
  if (newest) entries.reverse();
  return { entries, used };
};

/** One logical declaration; device streams keep independent opaque positions while sharing one reader. */
export const createLogCollection = (input: CollectionInput) => {
  const own = async () => ({
    ...input.definition,
    scope: input.scope,
    stream: input.definition.writer === "device" ? await input.writerId() : "project",
  });
  const streams = async () => {
    if (input.definition.writer !== "device") return [await own()];
    const known = await input.directory();
    return [
      ...new Map(
        known
          .filter(
            (entry) => entry.name === input.definition.name && entry.scope === input.scope && entry.writer === "device",
          )
          .map((entry) => [entry.stream, entry]),
      ).values(),
    ];
  };
  const readOne = async (entry: LogDirectoryEntry, options: StorageLogRead) => {
    const store = await input.open(entry);
    const remote = await input.remote(entry, store);
    return { entry, store, page: await (remote?.read(options) ?? store.read(options)) };
  };
  const read = async (options: StorageLogRead = {}) => {
    options = structuredClone(options);
    if (input.definition.writer !== "device") return (await readOne(await own(), options)).page;
    const positions = decodeCursor(input.address, options.after);
    const limit = logPageLimit(options.limit);
    const pages = await Promise.all(
      (await streams()).map(async (entry) => ({
        page: await (async () => {
          const store = await input.open(entry);
          const remote = await input.remote(entry, store);
          const selected = { after: cursorAt(positions, entry.stream), newest: options.newest, limit };
          const page = await (remote?.plan(selected) ?? store.plan?.(selected));
          if (!page) throw new Error("Device log storage requires metadata-only page planning");
          return page;
        })(),
        stream: entry.stream,
      })),
    );
    const merged = mergedEntries(pages, limit, options.newest ?? false);
    const payloads = new Map<string, Awaited<ReturnType<LogReadPlan["materialize"]>>[number]>();
    for (const item of pages) {
      const ids = merged.entries.filter((entry) => entry.stream === item.stream).map(({ entry }) => entry.id);
      for (const entry of await item.page.materialize(ids))
        payloads.set(JSON.stringify([item.stream, entry.id]), entry);
    }
    const next = new Map(Object.entries(positions));
    for (const item of pages) {
      const count = merged.used.get(item.stream) ?? 0;
      if (options.newest || count === item.page.entries.length) next.set(item.stream, item.page.cursor);
      else if (count)
        next.set(item.stream, merged.entries.filter((entry) => entry.stream === item.stream).at(-1)!.entry.cursor);
    }
    return {
      entries: merged.entries.flatMap(({ stream, entry }) => {
        const payload = payloads.get(JSON.stringify([stream, entry.id]));
        return payload ? [payload] : [];
      }),
      cursor: encodeText(JSON.stringify({ version: 1, address: input.address, positions: Object.fromEntries(next) })),
      more:
        !options.newest &&
        pages.some((item) => item.page.more || (merged.used.get(item.stream) ?? 0) < item.page.entries.length),
    };
  };
  return {
    async append(value: Parameters<LogStreamStore["append"]>[0], options?: { id?: string }) {
      const owned = structuredClone({ value, options });
      const entry = await own();
      await input.register(entry);
      return (await input.open(entry)).append(owned.value, owned.options);
    },
    read,
    follow: (options: { after?: string | 0; signal?: AbortSignal } = {}) =>
      followLogPages({
        after: options.after,
        signal: options.signal,
        read: (after) => read({ after }),
        watch: input.watch,
      }),
  };
};
