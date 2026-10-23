export { captureCheckpoint } from "./checkpoint-capture";
export { type DocumentHistory, documentHistory } from "./document-history";
export { documentRecordTypes, type RecordType, readDocumentRecord } from "./document-record";
export { type DocumentSnapshot, findDocumentReplacements, snapshotDocumentRecords } from "./document-replacements";
export { createDocumentStorage, type LockedRecords } from "./document-storage";
export { type DocumentState, type DocumentStore, hasDocumentUserData, memoryDocumentState } from "./document-types";
export * from "./encryption";
export { createLegacyRecordStorage } from "./legacy";
export { createMemoryDocumentStore } from "./memory-document-store";
export { initialRecordRevision, scopeRecordStorage, storageRecordId } from "./namespaces";
export {
  type ProjectInfo,
  projectInfoDocumentId,
  projectInfoState,
  readProjectInfo,
  writeProjectInfo,
} from "./project-info";
export { appendGroups, projectGroups, type RecordProjection } from "./projection";
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
export { editResourceDocument } from "./resource-document";
export type { NumberedResource } from "./resource-numbers";
export {
  coreOwnerId,
  nextResourceNumber,
  reconcileResourceNumbers,
  rememberResourceNumber,
  resourceIdentity,
  resourceNumbers,
  resourceNumbersDocumentId,
  resourceShorthand,
} from "./resource-numbers";
export { createRecordStorage } from "./storage";
export { createTextDocumentStorage } from "./text-document";
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
