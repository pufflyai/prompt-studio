import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/schema.ts", "./src/auth-schema.ts", "./src/team-managed-schema.ts"],
  out: "./drizzle",
});
