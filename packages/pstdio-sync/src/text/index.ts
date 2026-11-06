export { createTextDocumentStorage } from "./text-document";
export { mergeTextDocuments, prepareTextDocumentAdoption } from "./text-document-adoption";
export { applyTextEditorUpdate, editTextDocument, saveTextDocument } from "./text-document-edits";
export { initialTextDocumentState, readTextDocumentSeed, seedTextDocument } from "./text-document-seed";
export { TextEditorFrameError, validateTextEditorFrame, validateTextEditorState } from "./text-editor-frame";
export { editProjectedText } from "./text-file-projection";
export { createTextReplica, type TextReplicaSnapshot } from "./text-replica";
export {
  assertCompatibleTextImports,
  hasAnyTextSourceImport,
  hasTextSourceImport,
  importTextSource,
} from "./text-source-import";
export { writeText } from "./write-text";
