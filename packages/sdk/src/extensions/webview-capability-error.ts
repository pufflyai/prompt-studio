/** A host capability failure with details that survive the webview boundary. */
export interface WebviewCapabilityError extends Error {
  code: string;
  data?: unknown;
}

/** Works across extension bundles without depending on a shared Error class. */
export const isWebviewCapabilityError = (error: unknown): error is WebviewCapabilityError =>
  error instanceof Error && "code" in error && typeof error.code === "string";
