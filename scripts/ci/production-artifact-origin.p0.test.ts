import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

type Download = { uses?: string; with?: Record<string, string> };
type Workflow = { jobs: Record<string, { steps?: Download[] }> };
const evaluate = (expression: string, inputs: Record<string, string>) => {
  const terms = expression.replace(/^\$\{\{\s*|\s*\}\}$/g, "").split(/\s*\|\|\s*/);
  for (const term of terms) {
    if (term === "github.run_id") return "789";
    if (term.startsWith("inputs.")) {
      const value = inputs[term.slice(7)];
      if (value) return value;
    } else throw new Error(`Unexpected artifact origin expression: ${expression}`);
  }
  return "";
};

test.each([
  "production-desktop.yml",
  "production-performance.yml",
])("%s keeps payload and manifest producers separate", async (file) => {
  const workflow = Bun.YAML.parse(
    await readFile(resolve(import.meta.dirname, "../../.github/workflows", file), "utf8"),
  ) as Workflow;
  const downloads = Object.values(workflow.jobs)
    .flatMap((job) => job.steps ?? [])
    .filter((step) => step.uses?.startsWith("actions/download-artifact@"));
  expect(downloads).toHaveLength(2);
  for (const manifestRun of ["456", ""]) {
    const inputs = { artifact_run_id: "123", candidate_artifact_run_id: manifestRun };
    for (const step of downloads) {
      const values = step.with!;
      const isManifest = values["artifact-ids"]?.includes("inputs.candidate_artifact_id");
      expect(evaluate(values["run-id"]!, inputs)).toBe(isManifest ? manifestRun || "789" : "123");
      expect(values["github-token"]).toBe("${{ github.token }}");
    }
  }
});
