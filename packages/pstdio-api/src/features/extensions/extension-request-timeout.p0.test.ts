import { describe, expect, mock, test } from "bun:test";
import { disableExtensionPreparationTimeout } from "./extension-request-timeout";

const projectId = "project-1";

describe("extension request timeout", () => {
  test.each([
    `/v1/projects/${projectId}/extensions/instance-1/upgrade`,
    `/v1/projects/${projectId}/extensions/install`,
  ])("keeps long-running extension mutations connected for %s", (pathname) => {
    const request = new Request(`http://localhost:19840${pathname}`, { method: "POST" });
    const timeout = mock(() => {});

    disableExtensionPreparationTimeout(request, { timeout });

    expect(timeout).toHaveBeenCalledWith(request, 0);
  });

  test.each(["", "/ui", "/appearance"])("keeps cold project extension metadata reads connected for %s", (suffix) => {
    const request = new Request(`http://localhost:19840/v1/projects/${projectId}/extensions${suffix}`);
    const timeout = mock(() => {});
    disableExtensionPreparationTimeout(request, { timeout });
    expect(timeout).toHaveBeenCalledWith(request, 0);
  });

  test("keeps a saved view read connected while the extension resolves its board fields", () => {
    const request = new Request(`http://localhost:19840/v1/projects/${projectId}/boards/planner.tickets/views`);
    const timeout = mock(() => {});
    disableExtensionPreparationTimeout(request, { timeout });
    expect(timeout).toHaveBeenCalledWith(request, 0);
  });

  test("keeps the server timeout for other requests", () => {
    const request = new Request(`http://localhost:19840/v1/projects/${projectId}/extensions/other`, { method: "GET" });
    const timeout = mock(() => {});

    disableExtensionPreparationTimeout(request, { timeout });

    expect(timeout).not.toHaveBeenCalled();
  });
});
