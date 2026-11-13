import type { ExtensionContextBase, ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { reportRecord, reportsCollection } from "./collections";
import type { StoredReport } from "./types";

const key = Symbol.for("pstdio.pstdio-reports.writes");
const runtime = globalThis as typeof globalThis & { [key]?: Map<string, Promise<void>> };
runtime[key] ??= new Map();
const pending = runtime[key];

/** Reloaded handlers share the same queue; snapshots are read only after admission. */
export const withReportWrite = async <T>(
  ctx: Pick<ExtensionContextBase, "projectId" | "extensionId">,
  id: string,
  write: () => Promise<T>,
) => {
  const owner = JSON.stringify([ctx.projectId, ctx.extensionId, id]);
  const previous = pending.get(owner);
  const release = Promise.withResolvers<void>();
  pending.set(owner, release.promise);
  await previous;
  try {
    return await write();
  } finally {
    release.resolve();
    if (pending.get(owner) === release.promise) pending.delete(owner);
  }
};

export const replaceReport = async (storage: ExtensionStorageApi, revision: string, report: StoredReport) => {
  const record = reportRecord(report);
  if (!(await reportsCollection(storage).updateIfUnchanged(report.id, revision, record)))
    throw new Error("Report changed during this operation. Read the latest evidence and retry.");
  return record;
};
