import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./src/storage/schema.ts", "./src/storage/document-schema.ts", "./src/assets/schema.ts"],
  out: "./drizzle",
  dialect: "postgresql",
});
