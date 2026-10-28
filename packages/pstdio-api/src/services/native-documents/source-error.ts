export class NativeDocumentSourceError extends Error {
  constructor(
    readonly status: 400 | 404 | 502,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
