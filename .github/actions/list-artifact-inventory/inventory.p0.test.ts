import { expect, test } from "bun:test";
import { listArtifactInventory } from "./inventory.mts";

const digest = `sha256:${"a".repeat(64)}`;
const scope = Buffer.from(JSON.stringify({ scp: "Actions.Results:release-run:inventory-job" })).toString("base64url");
const results = {
  url: "https://results.example/",
  token: `head.${scope}.sig`,
  runId: "123",
  repository: "owner/repo",
};
const artifact = {
  databaseId: "234",
  workflowRunBackendId: "release-run",
  workflowJobRunBackendId: "upload-job",
  name: "desktop-linux-x64",
  digest,
};

test("the current-run inventory records exact names and upload digests only for readable archives", async () => {
  const fetched: string[] = [];
  const fetchMock = (async (input, init) => {
    const { hostname, pathname } = new URL(String(input));
    const headers = new Headers(init?.headers);
    fetched.push(pathname);
    if (hostname === "archives.example") {
      expect(headers.get("authorization")).toBeNull();
      expect(headers.get("range")).toBe("bytes=0-0");
      return pathname === "/removed" ? new Response(null, { status: 404 }) : new Response("z", { status: 206 });
    }
    expect(hostname).toBe("results.example");
    expect(headers.get("authorization")).toBe(`Bearer ${results.token}`);
    if (pathname.endsWith("/ListArtifacts")) {
      expect(JSON.parse(String(init?.body))).toEqual({
        workflow_run_backend_id: "release-run",
        workflow_job_run_backend_id: "inventory-job",
      });
      return Response.json({
        artifacts: [
          artifact,
          { ...artifact, databaseId: "235", name: "desktop-darwin-arm64" },
          { ...artifact, databaseId: "236", name: "desktop-linux-x64-unrelated" },
        ],
      });
    }
    const body = JSON.parse(String(init?.body));
    expect(body.workflow_run_backend_id).toBe("release-run");
    expect(body.workflow_job_run_backend_id).toBe("upload-job");
    return Response.json({
      signedUrl: `https://archives.example/${body.name === artifact.name ? "present" : "removed"}`,
    });
  }) as typeof fetch;
  expect(
    await listArtifactInventory({ fetch: fetchMock }, results, ["desktop-linux-x64", "desktop-darwin-arm64"]),
  ).toEqual([
    {
      artifacts: [
        { id: 234, name: "desktop-linux-x64", digest, expired: false },
        { id: 235, name: "desktop-darwin-arm64", digest, expired: true },
      ],
    },
  ]);
  expect(fetched).toHaveLength(5);
});

test("a distinct ID with the same name still reaches the production ambiguity check", async () => {
  const fetchMock = (async (input) => {
    const url = String(input);
    if (url.endsWith("/ListArtifacts"))
      return Response.json({ artifacts: [artifact, { ...artifact, databaseId: "235" }] });
    if (url.endsWith("/GetSignedArtifactURL")) return Response.json({ signed_url: "https://archives.example/desktop" });
    return new Response("z", { status: 206 });
  }) as typeof fetch;
  expect(await listArtifactInventory({ fetch: fetchMock }, results, [artifact.name])).toEqual([
    {
      artifacts: [
        { id: 234, name: artifact.name, digest, expired: false },
        { id: 235, name: artifact.name, digest, expired: false },
      ],
    },
  ]);
});
