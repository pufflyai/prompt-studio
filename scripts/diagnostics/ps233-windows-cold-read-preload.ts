import { PGlite } from "@electric-sql/pglite";

// Temporary synthetic-fixture profiling, never acceptance evidence. Do not print values.
const query = PGlite.prototype.query;
let flushes = 0;
let active = false;
let ordinal = 0;
PGlite.prototype.query = async function (...args: Parameters<typeof query>) {
  const statement = args[0];
  const flush = statement.includes("pg_stat_force_next_flush");
  if (flush && ++flushes === 1) active = true;
  const capture = active;
  const started = performance.now();
  try {
    return await Reflect.apply(query, this, args);
  } finally {
    if (capture)
      console.info(
        JSON.stringify({
          diagnostic: "first-record-query-sql",
          ordinal: ++ordinal,
          elapsedMs: performance.now() - started,
          sql: statement.slice(0, 2200),
        }),
      );
    if (flush && flushes === 2) active = false;
  }
};
console.info(JSON.stringify({ diagnostic: "first-record-query-profile", acceptance: false }));
