/** Host admission/transport failed; this says nothing about the extension's source. */
export class PreparationUnavailableError extends Error {
  readonly code = "extension_preparation_unavailable";
}
export const preparationUnavailable = (error: unknown) =>
  error instanceof PreparationUnavailableError
    ? error
    : new PreparationUnavailableError(error instanceof Error ? error.message : String(error), { cause: error });
