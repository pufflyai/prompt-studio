import { createDb } from "../src/db/connection.pglite";

// Use the same exclusive lock and data conversions as application startup. Running the
// schema migrator alone can drop old tables before their values have been transferred.
const connection = await createDb();
await connection.close();
console.log("Database migrations applied.");
