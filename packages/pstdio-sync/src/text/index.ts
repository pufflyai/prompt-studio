export { createTextDocumentStorage } from "./text-document";
export { mergeTextDocuments, prepareTextDocumentAdoption } from "./text-document-adoption";
export { applyTextEditorUpdate, editTextDocument, saveTextDocument } from "./text-document-edits";
export { initialTextDocumentState, readTextDocumentSeed, seedTextDocument } from "./text-document-seed";
export { editProjectedText } from "./text-file-projection";
export { createTextReplica, type TextReplicaSnapshot } from "./text-replica";
export { assertCompatibleTextImports, hasTextSourceImport, importTextSource } from "./text-source-import";
export { writeText } from "./write-text";
