import { downloadArtifacts } from "./download.mts";
import { getResultsContext } from "./results.mts";

const input = (name: string) => process.env[`INPUT_${name.toUpperCase()}`]?.trim() ?? "";

try {
  await downloadArtifacts({
    artifactIds: input("artifact-ids"),
    runId: input("run-id"),
    path: input("path") || process.env.GITHUB_WORKSPACE || process.cwd(),
    mergeMultiple: input("merge-multiple") === "true",
    token: input("github-token"),
    repository: input("repository"),
    apiUrl: process.env.GITHUB_API_URL ?? "https://api.github.com",
    results: getResultsContext(),
  });
} catch (error) {
  console.log(`::error::${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
