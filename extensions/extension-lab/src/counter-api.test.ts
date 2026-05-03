import { describe, expect, test } from "bun:test";
import {
  executeCounterCommand,
  executeSayHelloCommand,
  getCounterFromResponse,
  getProjectIdFromSearch,
} from "./counter-api";

describe("lab counter API", () => {
  test("reads the project id from the webview route query", () => {
    expect(getProjectIdFromSearch("?projectId=project-1")).toBe("project-1");
  });

  test("extracts the stored counter from a command outcome", () => {
    expect(
      getCounterFromResponse({
        commandId: "lab.counter.read",
        extensionId: "pstdio.extension-lab",
        outcome: { ok: true, status: "success", value: { counter: 4 } },
      }),
    ).toBe(4);
  });

  test("executes a counter command through the SDK extension client", async () => {
    const requests: { url: string; body: unknown }[] = [];
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return new Response(
        JSON.stringify({
          commandId: "lab.counter.bump",
          extensionId: "pstdio.extension-lab",
          outcome: { ok: true, status: "success", value: { counter: 5 } },
        }),
        { status: 200 },
      );
    };

    await expect(
      executeCounterCommand({
        commandId: "lab.counter.bump",
        projectId: "project-1",
        fetcher,
        params: { amount: -1 },
      }),
    ).resolves.toBe(5);

    expect(requests).toEqual([
      {
        url: "/v1/extensions/commands/lab.counter.bump/execute",
        body: { projectId: "project-1", params: { amount: -1 }, source: "dashboard" },
      },
    ]);
  });

  test("surfaces command execution API errors from the SDK client", async () => {
    const fetcher = async () =>
      new Response(JSON.stringify({ error: "Lab counter command is not registered." }), { status: 404 });

    await expect(
      executeCounterCommand({
        commandId: "lab.counter.bump",
        projectId: "project-1",
        fetcher,
      }),
    ).rejects.toThrow("Lab counter command is not registered.");
  });

  test("executes the say hello command through the SDK extension client", async () => {
    const requests: { url: string; body: unknown }[] = [];
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return new Response(
        JSON.stringify({
          commandId: "lab.say-hello",
          extensionId: "pstdio.extension-lab",
          outcome: {
            ok: true,
            status: "success",
            value: { message: "hello dispatched" },
            notices: [{ type: "info", title: "Lab", message: "Hello from the lab" }],
          },
        }),
        { status: 200 },
      );
    };

    await expect(executeSayHelloCommand({ projectId: "project-1", fetcher })).resolves.toEqual({
      commandId: "lab.say-hello",
      extensionId: "pstdio.extension-lab",
      outcome: {
        ok: true,
        status: "success",
        value: { message: "hello dispatched" },
        notices: [{ type: "info", title: "Lab", message: "Hello from the lab" }],
      },
    });

    expect(requests).toEqual([
      {
        url: "/v1/extensions/commands/lab.say-hello/execute",
        body: { projectId: "project-1", source: "dashboard" },
      },
    ]);
  });
});
