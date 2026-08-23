import { describe, expect, mock, test } from "bun:test";
import { disableExtensionMutationTimeout } from "./extension-request-timeout";

const projectId = "project-1";

describe("extension request timeout", () => {
  test.each([
    `/v1/projects/${projectId}/extensions/instance-1/upgrade`,
    `/v1/projects/${projectId}/extensions/marketplace/pstdio-planner/install`,
  ])("keeps long-running extension mutations connected for %s", (pathname) => {
    const request = new Request(`http://localhost:19840${pathname}`, { method: "POST" });
    const timeout = mock(() => {});

    disableExtensionMutationTimeout(request, { timeout });

    expect(timeout).toHaveBeenCalledWith(request, 0);
  });

  test("keeps the server timeout for other requests", () => {
    const request = new Request(`http://localhost:19840/v1/projects/${projectId}/extensions`, { method: "GET" });
    const timeout = mock(() => {});

    disableExtensionMutationTimeout(request, { timeout });

    expect(timeout).not.toHaveBeenCalled();
  });
});
