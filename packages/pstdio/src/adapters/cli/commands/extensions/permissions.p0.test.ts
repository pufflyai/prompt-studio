import { afterEach, describe, expect, mock, test } from "bun:test";
import { createHandler } from "./permissions";

const originalConsoleLog = console.log;
const state = {
  extensionId: "acme.agent",
  projectId: "project-1",
  sourceIdentity: "source-1",
  requested: ["ANTHROPIC_API_KEY", "GH_TOKEN"],
  granted: [],
  stale: false,
};

afterEach(() => {
  console.log = originalConsoleLog;
});

const setup = () => {
  const client = {
    get: mock(async () => state),
    grant: mock(async () => ({ ...state, granted: ["GH_TOKEN"] })),
    revoke: mock(async () => {}),
  };
  const printed: unknown[] = [];
  console.log = mock((value: string) => printed.push(JSON.parse(value))) as typeof console.log;
  return { client, printed, handler: createHandler(client) };
};

describe("extension permissions command", () => {
  test("shows requested and granted names for the project's extension", async () => {
    const { client, printed, handler } = setup();

    await handler({ action: "show", extension: "acme.agent", "project-id": "project-1" } as never);

    expect(client.get).toHaveBeenCalledWith("project-1", "acme.agent");
    expect(printed).toEqual([state]);
  });

  test("grants the chosen names for the source identity the caller observed", async () => {
    const { client, handler } = setup();

    await handler({
      action: "grant",
      extension: "acme.agent",
      "project-id": "project-1",
      names: "GH_TOKEN, ANTHROPIC_API_KEY",
      "source-identity": "source-1",
    } as never);

    expect(client.grant).toHaveBeenCalledWith("project-1", "acme.agent", {
      names: ["GH_TOKEN", "ANTHROPIC_API_KEY"],
      sourceIdentity: "source-1",
    });
  });

  test("refuses to grant without the observed source identity", async () => {
    const { client, handler } = setup();

    await expect(
      handler({ action: "grant", extension: "acme.agent", "project-id": "project-1", names: "GH_TOKEN" } as never),
    ).rejects.toThrow("--source-identity");
    expect(client.grant).not.toHaveBeenCalled();
  });

  test("revokes the project's grant", async () => {
    const { client, handler } = setup();

    await handler({ action: "revoke", extension: "acme.agent", "project-id": "project-1" } as never);

    expect(client.revoke).toHaveBeenCalledWith("project-1", "acme.agent");
  });
});
