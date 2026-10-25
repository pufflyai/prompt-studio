interface DiagnosticRequest {
  repository: string;
  headRepository: string;
  ref: string;
  sha: string;
  label: string;
  token: string;
  apiUrl?: string;
}

export const requestProductionDiagnostics = async (input: DiagnosticRequest) => {
  if (input.label !== "ci:full") return { requested: false, reason: "No full diagnostic request" };
  if (input.headRepository !== input.repository)
    return { requested: false, reason: "Fork diagnostics require an owner to dispatch a reviewed repository ref" };
  if (!/^[a-f0-9]{40}$/.test(input.sha) || !input.ref || !input.repository || !input.token)
    throw new Error("Missing diagnostic source identity or credentials");
  const response = await fetch(
    `${input.apiUrl ?? "https://api.github.com"}/repos/${input.repository}/actions/workflows/test-and-build.yml/dispatches`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.token}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ ref: input.ref, inputs: { profile: "production", source_sha: input.sha } }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) throw new Error(`Diagnostic dispatch failed: HTTP ${response.status}`);
  return { requested: true, reason: "Separate full functional diagnostics requested; fast PR gate is unchanged" };
};

if (import.meta.main) {
  const result = await requestProductionDiagnostics({
    repository: process.env.GITHUB_REPOSITORY ?? "",
    headRepository: process.env.PR_HEAD_REPOSITORY ?? "",
    ref: process.env.DIAGNOSTIC_REF ?? "",
    sha: process.env.PR_MERGE_SHA ?? "",
    label: process.env.PR_LABEL ?? "",
    token: process.env.GH_TOKEN ?? "",
    apiUrl: process.env.GITHUB_API_URL,
  });
  console.log(result.reason);
}
