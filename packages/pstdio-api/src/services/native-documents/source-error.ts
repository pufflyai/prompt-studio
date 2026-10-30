export class NativeDocumentSourceError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409 | 502,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
