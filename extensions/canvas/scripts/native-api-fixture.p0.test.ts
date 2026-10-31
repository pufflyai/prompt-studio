import { expect, test } from "bun:test";
import { apiClientOptions, previewFetch } from "./native-api-fixture";

test("preview requests use synthetic data and cannot reach a live project", async () => {
  expect(apiClientOptions().token).toBe("");
  const response = await previewFetch("https://canvas.invalid/v1/workspaces/example/diff-summary");
  expect(await response.json()).toEqual({ workspace_id: "example", additions: 128, deletions: 14, file_count: 6 });
  const write = await previewFetch("https://canvas.invalid/v1/projects/production", { method: "DELETE" });
  expect(write.status).toBe(501);
  await expect(previewFetch("http://127.0.0.1:49998/v1/projects")).rejects.toThrow("Missing local preview fixture");
});
