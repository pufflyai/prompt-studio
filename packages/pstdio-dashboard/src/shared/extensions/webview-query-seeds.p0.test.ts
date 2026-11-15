import { expect, test } from "bun:test";
import { authorizedWebviewQuerySeeds } from "./webview-query-seeds";

test("a guest without read grants receives no accepted account/device, performance, preference or command seeds", () => {
  let peeks = 0;
  const privateValues = {
    owner: "authorized",
    values: [
      {
        source: { service: "status" as const },
        snapshot: {
          generation: 1,
          version: 1,
          stale: false,
          fetching: false,
          data: { login: { accountId: "private" }, devices: ["private-device"] },
        },
      },
    ],
  };
  const input = {
    declared: [],
    capabilities: {
      "account.read": () => {},
      "performance.read": () => {},
      "preferences.get": () => {},
      "commands.query": () => {},
    },
    preferences: () => {
      throw new Error("private preference value was read");
    },
    account: () => {
      peeks++;
      return privateValues;
    },
    performance: () => {
      throw new Error("private process snapshot was read");
    },
    commands: () => {
      throw new Error("private command value was read");
    },
  };
  expect(authorizedWebviewQuerySeeds(input)).toEqual({
    commandQueries: undefined,
    serviceQueries: { account: undefined, performance: undefined, preferences: undefined },
  });
  expect(peeks).toBe(0);
  expect(authorizedWebviewQuerySeeds({ ...input, declared: ["account.read@1"] }).serviceQueries?.account).toBe(
    privateValues,
  );
  expect(peeks).toBe(1);
  expect(
    authorizedWebviewQuerySeeds({ ...input, declared: ["account.read@2"] }).serviceQueries?.account,
  ).toBeUndefined();
  expect(peeks).toBe(1);
  const preferenceValues = {
    owner: "preference-owner",
    values: [
      {
        source: { service: "preference" as const, name: "choice" },
        snapshot: { generation: 1, version: 1, stale: false, fetching: false, data: { value: "selected" } },
      },
    ],
  };
  expect(
    authorizedWebviewQuerySeeds({ ...input, declared: ["preferences.get@1"], preferences: () => preferenceValues })
      .serviceQueries?.preferences,
  ).toBe(preferenceValues);
  expect(
    authorizedWebviewQuerySeeds({ ...input, declared: ["preferences.get@2"] }).serviceQueries?.preferences,
  ).toBeUndefined();
});
