# Direct session startup must finish before database shutdown

A direct session start returns its durable session before asynchronous conversation initialization and harness startup finish. Resuming a saved session can do the same. Owning queue drains alone does not own these direct starts.

The full API run exposed a five-minute shutdown stall with one CPU saturated. Phase diagnostics showed harness disposal and both database maintenance flushes completed. A gated regression then proved shutdown passed the database boundary while a startup read was still held; releasing it issued SQL against a closed PGlite instance.

Track direct startup, resume, and their failure/bookkeeping work in the host's existing session queue lifecycle. Stop admitting starts when that lifecycle closes. A harness disposed during shutdown must leave its durable unstarted request for restart recovery rather than record an ordinary startup failure.

The regression must hold a real startup read, begin shutdown, wait for harness disposal, and verify database teardown has not started. Release the read and await shutdown. Keep coverage for both direct starts and resumes and for recovery of the original prompt and attachments.
