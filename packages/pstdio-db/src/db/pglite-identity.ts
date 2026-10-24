// The runtime image and every home are created in this database. Anything that opens a home,
// such as the export worker, must use it too: PGlite 0.4 otherwise opens "postgres".
export const pgliteIdentity = { database: "template1", username: "postgres" };
