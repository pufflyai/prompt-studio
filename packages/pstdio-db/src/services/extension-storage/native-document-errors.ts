export class NativeDocumentRoomError extends Error {
  constructor(
    readonly code: "not_found" | "missing_history" | "invalid_frame" | "history_changed",
    message: string,
  ) {
    super(message);
  }
}
