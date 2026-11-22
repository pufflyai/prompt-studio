import { expect, test } from "bun:test";
import { type BackendSurface, collectSurfaceValues, resolveSurfaceCall, SurfaceCallRejectedError } from "./surface";

const surface: BackendSurface = {
  kind: "object",
  members: {
    projectId: { kind: "value" },
    storage: {
      kind: "object",
      members: {
        collection: { kind: "factory", returns: { kind: "object", members: { get: { kind: "async" } } } },
      },
    },
  },
};

const host = {
  projectId: "p1",
  token: "secret",
  storage: {
    collection: (name: string) => ({ get: async (id: string) => `${name}/${id}`, drop: async () => "dropped" }),
    raw: async () => "raw",
  },
};

test("the host runs only calls its surface allows", async () => {
  const path = [{ name: "storage" }, { name: "collection", args: ["t"] }, { name: "get" }];
  expect(await resolveSurfaceCall(host, surface, path, ["a"], "async")).toBe("t/a");
  expect(() => resolveSurfaceCall(host, surface, path, ["a"], "notify")).toThrow(SurfaceCallRejectedError);
  for (const forged of [
    [{ name: "storage" }, { name: "raw" }],
    [{ name: "storage" }, { name: "collection", args: ["t"] }, { name: "drop" }],
    [{ name: "token" }],
    [{ name: "projectId" }],
    [{ name: "storage" }, { name: "collection" }, { name: "get" }],
    [{ name: "storage", args: [] }, { name: "collection", args: ["t"] }, { name: "get" }],
    [{ name: "__proto__" }],
    [{ name: "constructor" }],
  ])
    expect(() => resolveSurfaceCall(host, surface, forged, [], "async")).toThrow(SurfaceCallRejectedError);
});

test("only declared values are copied to the worker", () => {
  expect(collectSurfaceValues(host, surface)).toEqual({ '["projectId"]': "p1" });
});
