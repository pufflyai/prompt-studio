/** An observed native source changed before its save acquired the storage transaction lock. */
export class StorageRevisionChangedError extends Error {
  constructor() {
    super("The file changed since it was loaded. Reload it before saving.");
    this.name = "StorageRevisionChangedError";
  }
}
