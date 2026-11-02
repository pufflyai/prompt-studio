import * as Y from "yjs";
import { textDocumentKeys } from "./text-document-keys";
import { readTextDocumentSeed } from "./text-document-seed";
export class TextEditorFrameError extends Error {
  constructor(
    public code: "invalid_frame" | "missing_history",
    message: string,
  ) {
    super(message);
  }
}
const roots = new Set<string>(Object.values(textDocumentKeys));
const history = async (document: Y.Doc) => {
  if (document.store.pendingStructs || document.store.pendingDs)
    throw new TextEditorFrameError("missing_history", "The text frame is missing causal history");
  if ([...document.share.keys()].some((key) => !roots.has(key)))
    throw new TextEditorFrameError("invalid_frame", "A text session cannot contain unrelated roots");
  await readTextDocumentSeed(document);
  if (
    document
      .getText(textDocumentKeys.content)
      .toDelta()
      .some(
        (part: { insert: unknown; attributes?: Record<string, unknown> }) =>
          typeof part.insert !== "string" || Object.keys(part.attributes ?? {}).length,
      )
  )
    throw new TextEditorFrameError("invalid_frame", "A text session contains only plain source text");
};
const open = async (state: Uint8Array) => {
  const document = new Y.Doc({ gc: false });
  try {
    Y.applyUpdate(document, state);
    await history(document);
    return document;
  } catch (error) {
    document.destroy();
    if (error instanceof TextEditorFrameError) throw error;
    throw new TextEditorFrameError("invalid_frame", "Invalid text history");
  }
};
export const validateTextEditorState = async (state: Uint8Array) => {
  const document = await open(state);
  document.destroy();
};

/** Validate in an isolated history before admitting bytes to the durable room journal. */
export const validateTextEditorFrame = async (state: Uint8Array, update: Uint8Array) => {
  const document = await open(state);
  const changed = new Set<unknown>();
  document.on("afterTransaction", (transaction) => {
    for (const type of transaction.changedParentTypes.keys()) changed.add(type);
  });
  try {
    const decoded = Y.decodeUpdate(update);
    if (
      decoded.structs.some(
        (item) =>
          item instanceof Y.Item &&
          !(item.content instanceof Y.ContentString) &&
          !(item.content instanceof Y.ContentDeleted),
      )
    )
      throw new TextEditorFrameError("invalid_frame", "Text frames contain only source text");
    Y.applyUpdate(document, update);
    if ([...document.share].some(([key, type]) => key !== textDocumentKeys.content && changed.has(type)))
      throw new TextEditorFrameError("invalid_frame", "Text frames cannot change host metadata");
    await history(document);
  } catch (error) {
    if (error instanceof TextEditorFrameError) throw error;
    throw new TextEditorFrameError("invalid_frame", "Invalid text frame");
  } finally {
    document.destroy();
  }
};
