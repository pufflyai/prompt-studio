import { afterEach, describe, expect, it, mock } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { stopSession } from "./stop-session";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("useStopSession", () => {
  it("updates session status to cancelled", async () => {
    const fetchMock = mock(async () => new Response(null, { status: 204 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await stopSession("session-123");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:19840/v1/sessions/session-123/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
      }),
    );
  });

  it("wires useMutation to stopSession", async () => {
    const useMutationMock = mock((config: Record<string, unknown>) => ({
      mutate: () => {},
      isPending: false,
      ...config,
    }));

    mock.module("@tanstack/react-query", () => ({
      useMutation: useMutationMock,
    }));

    const { useStopSession } = await import(`./use-stop-session.ts?hook-test=${Date.now()}`);
    let result: { mutationFn: unknown } | undefined;
    const HookHarness = () => {
      result = useStopSession() as { mutationFn: unknown };
      return null;
    };

    renderToStaticMarkup(createElement(HookHarness));

    expect(useMutationMock).toHaveBeenCalledTimes(1);
    expect(result?.mutationFn).toBe(stopSession);
  });

  it("dedupes stop requests across menu and chat paths until settle", async () => {
    let onSettled: ((data: unknown, error: unknown, sessionId: string) => void) | undefined;
    const mutateMock = mock(() => {});

    mock.module("@tanstack/react-query", () => ({
      useMutation: (config: { onSettled?: (data: unknown, error: unknown, sessionId: string) => void }) => {
        onSettled = config.onSettled;
        return { mutate: mutateMock, isPending: false };
      },
    }));

    const { useStopSession } = await import(`./use-stop-session.ts?hook-dedupe-test=${Date.now()}`);
    let result: ReturnType<typeof useStopSession> | undefined;
    const HookHarness = () => {
      result = useStopSession();
      return null;
    };

    renderToStaticMarkup(createElement(HookHarness));

    result?.requestStopSession("session-1");
    result?.requestStopSession("session-1");

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith("session-1");

    onSettled?.(undefined, null, "session-1");
    result?.requestStopSession("session-1");

    expect(mutateMock).toHaveBeenCalledTimes(2);
  });
});
