export { runBinaryTask } from "./binary-background";
export { startBinaryWorker } from "./binary-worker-runtime";
export { captureCheckpoint } from "./checkpoint-capture";
export {
  acceptDocumentCheckpoint,
  applyDocumentBinaryUpdate,
  documentRevision,
  exportDocumentBinary,
  snapshotDocumentBinary,
  trackDocumentBinary,
} from "./document-binary";
export { buildRecordFragments, type RecordFragment } from "./document-fragments";
export { type DocumentHistory, documentHistory } from "./document-history";
export { trackDocumentPayload } from "./document-payload";
export { documentRecordTypes, type RecordType, readDocumentRecord } from "./document-record";
export type { RecordOwnershipRange } from "./document-record-ownership";
export { type DocumentSnapshot, findDocumentReplacements, snapshotDocumentRecords } from "./document-replacements";
export { createDocumentStorage } from "./document-storage";
export { type DocumentState, type DocumentStore, hasDocumentUserData, memoryDocumentState } from "./document-types";
export * from "./encryption";
export { createLegacyRecordStorage } from "./legacy";
export { createMemoryDocumentStore } from "./memory-document-store";
export { initialRecordRevision, scopeRecordStorage, storageRecordId } from "./namespaces";
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
export type { NumberedResource } from "./resource-numbers";
export {
  nextResourceNumber,
  reconcileResourceNumbers,
  rememberResourceNumber,
  resourceIdentity,
  resourceNumbers,
  resourceNumbersDocumentId,
  resourceNumbersOwnerId,
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
