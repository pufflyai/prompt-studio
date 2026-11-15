/** Opt-in local query diagnostics: no predicates, projected values, documents or credentials. */
export const traceStorageQuery = (phase: string, index: string) => {
  if (process.env.PSTDIO_STORAGE_QUERY_TRACE === "1")
    console.info(JSON.stringify({ diagnostic: "storage-query", phase, index, at: performance.now() }));
};
