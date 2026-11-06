import { canonicalJson } from "pstdio-sync-contracts";
import * as Y from "yjs";
import { decodeBytes } from "../shared";
import { readTextDocumentSeed, saveTextDocument } from "../text";
import { parseJsonPointer } from "./ordered-json";
import { type OrderedRecord, prepareOrderedOperation } from "./ordered-operation";
import { prepareOrderedText, readOrderedPath } from "./ordered-text";
import { orderedTextLifetime } from "./ordered-text-lifetime";

/** First Cloud join submits local records as new unconditional saves, never their old conditions. */
export const prepareOrderedLocalAdoption = async (local: OrderedRecord, remote: OrderedRecord | undefined) => {
  if (
    local.deleted === remote?.deleted &&
    canonicalJson(local.value) === canonicalJson(remote.value) &&
    Object.entries(local.texts ?? {}).every(([pointer, state]) => state.state === remote.texts?.[pointer]?.state)
  )
    return;
  const operationId = `first-join:${crypto.randomUUID()}`;
  // Recreation retires the tombstone's old text history, just as the public compiler does.
  const baseline = remote?.deleted
    ? { ...remote, texts: undefined, lifetime: JSON.stringify(["recreate", operationId]), value: {} }
    : remote;
  const texts = [];
  if (!local.deleted)
    for (const pointer of new Set([...Object.keys(local.texts ?? {}), ...Object.keys(remote?.texts ?? {})])) {
      const path = parseJsonPointer(pointer);
      const value = readOrderedPath(local.value, path);
      if (typeof value !== "string") continue;
      texts.push(
        await prepareOrderedText({
          recordId: local.recordId,
          lifetime: orderedTextLifetime(baseline, path),
          path,
          value: baseline?.value ?? {},
          saved: baseline?.texts?.[pointer],
          edit: async (document) => {
            const saved = local.texts?.[pointer];
            // Retain original local structs when histories share genesis. A stale editor
            // can then resend its full state without inserting the same local bytes twice.
            if (saved?.seed === (await readTextDocumentSeed(document)).id)
              Y.applyUpdate(document, decodeBytes(saved.state));
            saveTextDocument(document, value);
          },
        }),
      );
    }
  return prepareOrderedOperation(
    {
      operationId,
      edits: [
        {
          recordId: local.recordId,
          deleted: local.deleted,
          changes: local.deleted ? [] : [{ path: [], set: structuredClone(local.value) }],
          texts,
        },
      ],
    },
    remote ? new Map([[remote.recordId, remote]]) : new Map(),
  );
};
