import type { AssetReference } from "pstdio-api-contracts";
import type {
  CommandOutcome,
  ExtensionStorageApi,
  JsonValue,
  StorageRecord,
} from "pstdio-api-contracts/extension-kernel";
import { CommandFailure, type Records, type SaveOptions, type SessionFilter } from "./contracts";
import { failure } from "./support";

export const saveRecord = (records: Records, record: StorageRecord, value: JsonValue, options: SaveOptions) =>
  records.commit({
    operationId: options.operationId,
    edits: [{ recordId: record.recordId, expectedRevision: record.revision, replace: value }],
  });

const referenceFor = async (file: File) => {
  const hash = new Bun.CryptoHasher("sha256");
  for await (const chunk of file.stream()) hash.update(chunk);
  return { sha256: hash.digest("hex"), byteLength: file.size, mediaType: file.type || "application/octet-stream" };
};

const sameAsset = (first: AssetReference | null, second: AssetReference) =>
  first?.sha256 === second.sha256 && first.byteLength === second.byteLength && first.mediaType === second.mediaType;

const readAttachmentReceipt = async (
  records: Records,
  recordId: string,
  parentRecordId: string,
  file: File,
  operationId: string,
) => {
  const known = await records.outcome(operationId);
  if (!known) return null;
  const original = await records.read(recordId, { operationId });
  const value = original.value;
  const reference = await referenceFor(file);
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.parentRecordId !== parentRecordId ||
    value.name !== file.name ||
    !sameAsset(original.asset, reference)
  )
    throw failure("operation_payload_changed");
  if (known.status === "conflict") throw failure("attachment_conflict");
  return { recordId };
};

export const attachFile = async (
  storage: ExtensionStorageApi,
  parentRecordId: string,
  file: File,
  options: SaveOptions,
) => {
  const records = storage.records;
  const recordId = records.id(`attachment:${options.operationId}`);
  const known = await readAttachmentReceipt(records, recordId, parentRecordId, file, options.operationId);
  if (known) return known;
  const base = await records.read(recordId);
  if (base.exists) {
    const concurrent = await readAttachmentReceipt(records, recordId, parentRecordId, file, options.operationId);
    if (concurrent) return concurrent;
    throw failure("attachment_identity_in_use");
  }
  const asset = await storage.assets.stage({ operationId: `${options.operationId}:bytes`, source: file });
  const outcome = await records.commit({
    operationId: options.operationId,
    edits: [
      {
        recordId,
        expectedRevision: base.revision,
        replace: { parentRecordId, name: file.name },
        asset,
      },
    ],
  });
  if (outcome.status === "conflict") throw failure("attachment_conflict");
  return { recordId };
};

export const iterateSessions = async function* (
  query: import("./contracts").CurrentApi["sessions"]["query"],
  filter: SessionFilter,
) {
  let cursor: string | undefined;
  do {
    const page = await query({ ...filter, cursor, limit: 50 });
    yield* page.items;
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
};

export const rejectedCommand = async (outcome: Extract<CommandOutcome, { ok: false }>) => {
  throw new CommandFailure(outcome);
};

export const createCommandStream = () => {
  let cancelled = false;
  let settled = false;
  let finish!: (outcome: CommandOutcome<string>) => void;
  const outcome = new Promise<CommandOutcome<string>>((resolve) => {
    finish = resolve;
  });
  const cancel = async () => {
    if (settled) return;
    settled = true;
    cancelled = true;
    finish({ ok: false, status: "rejected", code: "cancelled", reason: "Command cancelled." });
  };
  return {
    outcome,
    cancel,
    async *[Symbol.asyncIterator]() {
      try {
        for (const chunk of ["first", "second"]) {
          if (cancelled) return;
          yield chunk;
        }
        settled = true;
        finish({ ok: true, status: "success", value: "finished" });
      } finally {
        if (!settled) await cancel();
      }
    },
  };
};
