export { captureCheckpoint } from "./checkpoint-capture";
export { type DocumentHistory, documentHistory } from "./document-history";
export { documentRecordTypes, type RecordType, readDocumentRecord } from "./document-record";
export { type DocumentSnapshot, findDocumentReplacements, snapshotDocumentRecords } from "./document-replacements";
export { createDocumentStorage, type LockedRecords } from "./document-storage";
export {
  type DocumentState,
  type DocumentStore,
  hasDocumentUserData,
  isEmptyDocument,
  memoryDocumentState,
} from "./document-types";
export * from "./encryption";
export { createLegacyRecordStorage } from "./legacy";
export { createMemoryDocumentStore } from "./memory-document-store";
export { initialRecordRevision, scopeRecordStorage, storageRecordId } from "./namespaces";
export { nativeAssetBaseline, nativeAssetBindingBaseline } from "./native-asset-source";
export {
  bindRecordText,
  bindRecordTextAsset,
  type NativeRecordSources,
  nativeFieldValue,
  nativeTextAssetKey,
  prepareRecordTextEdit,
  readNativeRecordSources,
  recordTextBindingUpdate,
  setNativeFieldValue,
} from "./native-record-source";
export { NativeSourcePendingError, NativeSourceRecoveryError } from "./native-source-recovery";
export {
  type ProjectInfo,
  projectInfoDocumentId,
  projectInfoState,
  readProjectInfo,
  writeProjectInfo,
} from "./project-info";
export { appendGroups, projectGroups, type RecordProjection } from "./projection";
export { adoptionEdit, mergeJson } from "./record-adoption";
export { recordLifetime } from "./record-lifetime";
export {
  compareQueryValues,
  encodeQueryCursor,
  fieldValue,
  matchesPredicate,
  prepareRecordQuery,
  queryField,
  typedFieldValue,
  validateIndexes,
  validatePredicate,
} from "./record-query";
export { applyRecordChange, blankRecord, recordConflict } from "./records";
export { type ResolutionState, validateResolution } from "./resolution-validation";
export {
  adoptResourceDocument,
  editResourceDocument,
  mergeResourceDocument,
  type ResourceMigration,
  resourceDocumentState,
  retainedResourceValue,
} from "./resource-document";
export type { NumberedResource } from "./resource-numbers";
export {
  coreOwnerId,
  rememberResourceNumber,
  resourceNumbers,
  resourceNumbersDocumentId,
  resourceShorthand,
} from "./resource-numbers";
export { createRecordStorage } from "./storage";
export { StorageRevisionChangedError } from "./storage-revision-error";
export { createTextDocumentStorage } from "./text-document";
export { mergeTextDocuments, prepareTextDocumentAdoption } from "./text-document-adoption";
export { applyTextEditorUpdate, editTextDocument, saveTextDocument } from "./text-document-edits";
export { initialTextDocumentState, readTextDocumentSeed, seedTextDocument } from "./text-document-seed";
export { editProjectedText } from "./text-file-projection";
export { hasTextSourceImport, importTextSource } from "./text-source-import";
export type {
  Acceptance,
  AssetStore,
  GroupCommit,
  GroupedState,
  GroupedStore,
  JournalEntry,
  LocalOperation,
  RelayAdapter,
  RelayAssets,
  StorageObserver,
  StorageOwner,
} from "./types";
