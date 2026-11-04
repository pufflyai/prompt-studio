import { NativeDocumentRoomError } from "pstdio-db";
import { hasAnyTextSourceImport, hasTextSourceImport } from "pstdio-sync/text";
import * as Y from "yjs";
import { NativeDocumentSourceError } from "./source-error";

/** Old-lifetime recovery frames may be retained, but cannot become the recreated source's initial history. */
export const validateReplaySource = (
  state: Uint8Array | undefined,
  documentKey: string,
  lifetime: string,
  generation?: string,
  proof?: string,
) => {
  if (!state) return;
  if (generation !== proof)
    throw new NativeDocumentSourceError(
      409,
      "source_retired",
      "These saved edits belong to another local text replica",
    );
  const document = new Y.Doc();
  try {
    Y.applyUpdate(document, state);
    const imported = hasAnyTextSourceImport(document);
    if (imported && hasTextSourceImport(document, documentKey)) return;
    if (!imported && lifetime === "initial") return;
    throw new NativeDocumentSourceError(409, "source_retired", "These pending edits belong to another source lifetime");
  } catch (error) {
    if (error instanceof NativeDocumentSourceError) throw error;
    throw new NativeDocumentRoomError("invalid_frame", "Invalid editor recovery source");
  } finally {
    document.destroy();
  }
};
