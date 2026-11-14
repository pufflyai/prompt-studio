import { readContract } from "pstdio-benchmarks/writer";

const contract = readContract(process.cwd());
if (!process.env.GITHUB_ACTIONS || !process.env.GITHUB_TOKEN)
  throw new Error("Catalog approval is recorded only after protected environment review");
const base = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}`;
const request = async (path: string, body: object) => {
  const response = await fetch(`${base}/${path}`, {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Cannot retain catalog approval: ${response.status}`);
  return response.json();
};
const deployment = await request("deployments", {
  ref: process.env.GITHUB_SHA,
  environment: "benchmark-catalog",
  auto_merge: false,
  required_contexts: [],
  transient_environment: false,
  production_environment: false,
  payload: { catalogDigest: contract.digest, revision: contract.revision, runId: Number(process.env.GITHUB_RUN_ID) },
});
await request(`deployments/${deployment.id}/statuses`, {
  state: "success",
  environment: "benchmark-catalog",
  auto_inactive: false,
  log_url: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  description: `Human reviewed catalog revision ${contract.revision}`,
});
console.log(JSON.stringify({ ...contract, deployment: deployment.id }));
