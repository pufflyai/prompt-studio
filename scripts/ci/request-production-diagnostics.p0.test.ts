import { expect, test } from "bun:test";
import { requestProductionDiagnostics } from "./request-production-diagnostics";

test("an internal full diagnostic request dispatches the exact merged source separately", async () => {
  const requests: unknown[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      expect(request.method).toBe("POST");
      expect(request.headers.get("authorization")).toBe("Bearer fixture");
      requests.push(await request.json());
      return new Response(null, { status: 204 });
    },
  });
  try {
    const input = {
      repository: "owner/repo",
      headRepository: "owner/repo",
      ref: "feature/example",
      sha: "a".repeat(40),
      label: "ci:full",
      token: "fixture",
      apiUrl: server.url.origin,
    };
    expect((await requestProductionDiagnostics(input)).requested).toBe(true);
    expect(requests).toEqual([{ ref: input.ref, inputs: { profile: "production", source_sha: input.sha } }]);
    expect((await requestProductionDiagnostics({ ...input, headRepository: "fork/repo" })).requested).toBe(false);
    expect((await requestProductionDiagnostics({ ...input, label: "other" })).requested).toBe(false);
    expect(requests).toHaveLength(1);
  } finally {
    await server.stop(true);
  }
});
