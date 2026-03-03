import { defineConfig } from "drizzle-kit";
import { resolveDbPath } from "./src/db/paths";

export const createDrizzleConfig = (dbPath?: string) =>
  defineConfig({
    dialect: "postgresql",
    driver: "pglite",
    schema: "./src/db/schemas.pg.ts",
    out: "./drizzle",
    dbCredentials: {
      url: resolveDbPath(dbPath),
    },
  });

export default createDrizzleConfig();
