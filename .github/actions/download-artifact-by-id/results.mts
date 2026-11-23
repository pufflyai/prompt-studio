import { readBody, request, type TransferOptions } from "./transfer.mts";

export interface ResultsContext {
  url: string;
  token: string;
  runId: string;
  repository: string;
}

export const getResultsContext = (): ResultsContext | undefined => {
  const {
    ACTIONS_RESULTS_URL: url,
    ACTIONS_RUNTIME_TOKEN: token,
    GITHUB_RUN_ID: runId,
    GITHUB_REPOSITORY: repository,
  } = process.env;
  return url && token && runId && repository ? { url, token, runId, repository } : undefined;
};

interface ResultArtifact {
  database_id?: string;
  databaseId?: string;
  workflow_run_backend_id?: string;
  workflowRunBackendId?: string;
  workflow_job_run_backend_id?: string;
  workflowJobRunBackendId?: string;
  name: string;
  digest?: string;
}

export const apiError = async (response: Response) => {
  const body = await response.text();
  try {
    const { message, msg } = JSON.parse(body) as { message?: string; msg?: string };
    return `HTTP ${response.status}: ${message ?? msg ?? body}`;
  } catch {
    return `HTTP ${response.status}: ${body.slice(0, 500)}`;
  }
};

const resultsScope = (token: string) => {
  const invalid = new Error("The Actions runtime token has no valid Actions Results scope");
  let scp: unknown;
  try {
    const payload = Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8");
    scp = (JSON.parse(payload) as { scp?: unknown }).scp;
  } catch {
    throw invalid;
  }
  const scope =
    typeof scp === "string" ? scp.split(" ").find((value) => value.startsWith("Actions.Results:")) : undefined;
  const parts = scope?.split(":") ?? [];
  if (parts.length !== 3 || !parts[1] || !parts[2]) throw invalid;
  return { workflow_run_backend_id: parts[1], workflow_job_run_backend_id: parts[2] };
};

export const createResultsClient = (options: TransferOptions, results: ResultsContext, context = "") => {
  const scope = resultsScope(results.token);
  const post = async <T,>(method: string, body: Record<string, string>) => {
    const endpoint = new URL(`/twirp/github.actions.results.api.v1.ArtifactService/${method}`, results.url).href;
    const response = await request(options, endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${results.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      redirect: "error",
    });
    if (!response.ok) throw new Error(`Actions Results ${method} failed${context}: ${await apiError(response)}`);
    return JSON.parse((await readBody(options, response)).toString("utf8")) as T;
  };
  return {
    async list(filter: { id_filter?: string } = {}) {
      const { artifacts = [] } = await post<{ artifacts?: ResultArtifact[] }>("ListArtifacts", { ...scope, ...filter });
      return artifacts.map((artifact) => {
        const id = artifact.database_id ?? artifact.databaseId;
        const run = artifact.workflow_run_backend_id ?? artifact.workflowRunBackendId;
        const job = artifact.workflow_job_run_backend_id ?? artifact.workflowJobRunBackendId;
        if (!id || run !== scope.workflow_run_backend_id || !job || !artifact.name)
          throw new Error(`Actions Results returned an unexpected identity${context}`);
        return { id, run, job, name: artifact.name, digest: artifact.digest };
      });
    },
    async signedUrl(artifact: { run: string; job: string; name: string }) {
      const signed = await post<{ signed_url?: string; signedUrl?: string }>("GetSignedArtifactURL", {
        workflow_run_backend_id: artifact.run,
        workflow_job_run_backend_id: artifact.job,
        name: artifact.name,
      });
      const url = signed.signed_url ?? signed.signedUrl;
      if (!url) throw new Error(`Actions Results did not provide a download URL${context}`);
      return url;
    },
  };
};
