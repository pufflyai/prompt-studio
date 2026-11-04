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
  applyOrderedOperation,
  type OrderedAdmission,
  type OrderedDecision,
  type OrderedEdit,
  type OrderedOperation,
  type OrderedRecord,
  observeOrderedRecord,
  prepareOrderedOperation,
  projectOrderedOperation,
} from "./ordered-operation";
export {
  type ProjectInfo,
  projectInfoDocumentId,
  projectInfoState,
  readProjectInfo,
  writeProjectInfo,
} from "./project-info";
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
export type { GroupCommit } from "./types";
