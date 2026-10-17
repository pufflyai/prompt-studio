export class AssetTransferError extends Error {
  constructor(
    public readonly code: string,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "AssetTransferError";
  }
}
