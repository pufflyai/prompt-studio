import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { completeBenchmarkWorker } from "./benchmark-case";
import { completeFixturePreparation } from "./prepared-fixture";

const [action, root, mode] = process.argv.slice(2);
const close = () => {
  if (mode === "close-failure") throw new Error("Close failed");
  writeFileSync(join(root, "closed"), "yes");
};
if (action === "prepare")
  await completeFixturePreparation(async () => {
    try {
      writeFileSync(join(root, "state.json"), JSON.stringify({ value: "prepared", preparedPid: process.pid }));
      if (mode === "seed-failure") throw new Error("Seed failed");
      if (mode === "verify-failure") throw new Error("Verification failed");
      return { records: 1000, seedCommits: 4 };
    } finally {
      close();
    }
  });
else
  await completeBenchmarkWorker(async () => {
    // The sample's first data access is a write; metadata was validated by the controller.
    writeFileSync(join(root, "state.json"), JSON.stringify({ value: "edited" }));
    const manifest = JSON.parse(readFileSync(join(root, "sample-provenance.json"), "utf8"));
    writeFileSync(
      join(root, "sample-observed.json"),
      JSON.stringify({ firstAccess: "write", readBeforeWrite: false, preparedPid: manifest.preparation.pid }),
    );
  });
