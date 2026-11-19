import { expect, test } from "bun:test";
import { workbenchErrorDetails } from "./workbench-error";

test("logs bounded workbench diagnostics without session or runtime credentials", () => {
  const details = workbenchErrorDetails(
    {
      projectId: "project-1",
      message: "Request failed with Authorization: Bearer renderer-secret",
      stack: `Error: runtime-secret\n${"x".repeat(13_000)}`,
      componentStack: "\n at ProjectView",
    },
    ["runtime-secret"],
  );
  expect(details).toMatchObject({
    event: "desktop.workbench.error",
    projectId: "project-1",
    componentStack: "\n at ProjectView",
  });
  expect(details?.stack).toHaveLength(12_000);
  expect(JSON.stringify(details)).not.toMatch(/renderer-secret|runtime-secret/);
  expect(workbenchErrorDetails({ message: [] }, [])).toBeUndefined();
});
