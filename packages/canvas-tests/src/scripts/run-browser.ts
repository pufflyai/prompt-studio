import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const child = spawn(
  "node",
  [
    createRequire(import.meta.url).resolve("@playwright/test/cli"),
    "test",
    ...(process.env.COMPONENT_TEST_FILES ? JSON.parse(process.env.COMPONENT_TEST_FILES) : []),
    ...process.argv.slice(2),
  ],
  { env: process.env, stdio: "inherit" },
);
child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
