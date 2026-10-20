export { captureCheckpoint } from "./checkpoint-capture";
export { type DocumentHistory, documentHistory } from "./document-history";
export { createDocumentStorage } from "./document-storage";
export { type DocumentState, type DocumentStore, hasDocumentUserData, memoryDocumentState } from "./document-types";
export * from "./encryption";
export { createLegacyRecordStorage } from "./legacy";
export { createMemoryDocumentStore } from "./memory-document-store";
export { initialRecordRevision, scopeRecordStorage, storageRecordId } from "./namespaces";
export { appendGroups, projectGroups, type RecordProjection } from "./projection";
export { applyRecordChange, blankRecord, recordConflict } from "./records";
export { type ResolutionState, validateResolution } from "./resolution-validation";
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
