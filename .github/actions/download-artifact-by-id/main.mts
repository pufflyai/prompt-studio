import { downloadArtifacts } from "./download.mts";

const input = (name: string) => process.env[`INPUT_${name.toUpperCase()}`]?.trim() ?? "";
const {
  ACTIONS_RESULTS_URL: resultsUrl,
  ACTIONS_RUNTIME_TOKEN: runtimeToken,
  GITHUB_RUN_ID: currentRunId,
  GITHUB_REPOSITORY: currentRepository,
} = process.env;

try {
  await downloadArtifacts({
    artifactIds: input("artifact-ids"),
    runId: input("run-id"),
    path: input("path") || process.env.GITHUB_WORKSPACE || process.cwd(),
    mergeMultiple: input("merge-multiple") === "true",
    token: input("github-token"),
    repository: input("repository"),
    apiUrl: process.env.GITHUB_API_URL ?? "https://api.github.com",
    results:
      resultsUrl && runtimeToken && currentRunId && currentRepository
        ? { url: resultsUrl, token: runtimeToken, runId: currentRunId, repository: currentRepository }
        : undefined,
  });
} catch (error) {
  console.log(`::error::${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
