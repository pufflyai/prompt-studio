/** Valid saved source data whose causal baseline cannot be inferred safely. */
export class NativeSourceRecoveryError extends Error {
  readonly code = "native_source_recovery";
  constructor(
    message: string,
    readonly recordId?: string,
  ) {
    super(message);
    this.name = "NativeSourceRecoveryError";
  }
}

/** A source pointer can arrive before its standalone encrypted text. */
export class NativeSourcePendingError extends Error {
  readonly code = "native_source_pending";
  constructor() {
    super("This file's shared text is still downloading. Its saved data has been retained.");
    this.name = "NativeSourcePendingError";
  }
}

/** The logical source was deleted; retained text must not recreate its domain record. */
export class NativeSourceRetiredError extends Error {
  readonly code = "native_source_retired";
  constructor(readonly recordId: string) {
    super("The text source no longer exists. Its saved text has been retained.");
    this.name = "NativeSourceRetiredError";
  }
}
