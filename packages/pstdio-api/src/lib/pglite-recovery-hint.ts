// PGlite reports a damaged write-ahead log as an opaque PANIC or WASM abort, and both the API
// server and the CLI surface it to users of the published package — so the repair steps travel
// with the message instead of pointing at documentation that only exists in this repository.
const CHECKPOINT_FAILURE = /could not locate a valid checkpoint record|Aborted\(\)/i;

export const isPgliteCheckpointFailure = (output: string) => CHECKPOINT_FAILURE.test(output);

export const pgliteRecoverySteps = (dbPath: string) =>
  `Most data is usually recoverable: stop every pstdio process, back up ${dbPath}, then reset the write-ahead log with PostgreSQL 17's pg_resetwal (pg_resetwal -f ${dbPath})`;
