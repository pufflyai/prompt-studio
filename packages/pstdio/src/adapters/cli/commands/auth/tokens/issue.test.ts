import { afterEach, describe, expect, mock, test } from "bun:test";
import { createHandler, parseExpirySeconds } from "./issue";

const originalConsoleLog = console.log;

afterEach(() => {
  console.log = originalConsoleLog;
});

describe("machine token issue command", () => {
  test("parses supported expiry units", () => {
    expect(parseExpirySeconds("30m")).toBe(1800);
    expect(parseExpirySeconds("24h")).toBe(86400);
    expect(parseExpirySeconds("90d")).toBe(7_776_000);
    expect(() => parseExpirySeconds("forever")).toThrow("minutes, hours, or days");
  });

  test("sends exact project and command scopes to the SDK", async () => {
    const issueToken = mock(async () => ({ token: "pst_at_once" }));
    console.log = mock(() => {}) as typeof console.log;
    const handler = createHandler({ issueToken } as never);

    await handler({
      name: "notion-trigger",
      project: "project-1",
      principal: "bdc12954-57dc-4010-acd1-fb2bc55194f5",
      command: ["pstdio.planner.command.start-attempt"],
      expiresIn: "30d",
    } as never);

    expect(issueToken).toHaveBeenCalledWith({
      name: "notion-trigger",
      projectId: "project-1",
      principalId: "bdc12954-57dc-4010-acd1-fb2bc55194f5",
      commandScopes: ["pstdio.planner.command.start-attempt"],
      expiresInSeconds: 2_592_000,
    });
  });
});
