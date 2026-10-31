export { captureCheckpoint } from "./checkpoint-capture";
export { recordTypeName } from "./document-edits";
export { documentRecordTypes, type RecordType, readDocumentRecord } from "./document-record";
export { type DocumentSnapshot, findDocumentReplacements, snapshotDocumentRecords } from "./document-replacements";
export { createDocumentStorage, type LockedRecords } from "./document-storage";
export { createLegacyRecordStorage } from "./legacy";
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
export {
  type ProjectInfo,
  projectInfoDocumentId,
  projectInfoState,
  readProjectInfo,
  writeProjectInfo,
} from "./project-info";
export { appendGroups, projectGroups, type RecordProjection } from "./projection";
export { adoptionEdit, mergeJson } from "./record-adoption";
export { hasEarlierRecordLifetime, recordLifetime } from "./record-lifetime";
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
export type {
  Acceptance,
  GroupCommit,
  GroupedState,
  GroupedStore,
  JournalEntry,
  LocalOperation,
  RelayAdapter,
} from "./types";
