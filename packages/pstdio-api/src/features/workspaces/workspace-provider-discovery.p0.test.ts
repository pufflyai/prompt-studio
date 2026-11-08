import { expect, mock, test } from "bun:test";
import { params } from "@pstdio/sdk/extensions";
import type { WorkspacesRouteDeps } from "./deps";
import { listWorkspaceProviders } from "./workspace-provider-catalog";
import { resolveWorkspaceParams } from "./workspace-provider-params";
import { createProviderBackedWorkspace } from "./workspace-provider-service";

const discoveryFixture = () => {
  let revision: string | null | Error = "main";
  const provider = {
    id: "local",
    ref: { kind: "workspace-type", extensionId: "example.local", id: "local" },
    label: "Local environment",
    params: { revision: params.text({ defaultValue: "static-fallback" }) },
    discover: async (ctx: { projectId: string }) => {
      expect(ctx.projectId).toBe("project");
      if (revision instanceof Error) throw revision;
      return revision === null ? null : { params: { revision: params.text({ defaultValue: revision }) } };
    },
    create: async () => ({}),
    resolve: async () => ({}),
  };
  const id = "example.local.workspace-type.local";
  const staticProvider = { ...provider, id: "static", discover: undefined };
  const staticId = "example.local.workspace-type.static";
  const deps = {
    workspaceService: { getDefault: async () => null },
    extensionRuntimeCatalog: {
      get: async () => ({
        runtime: {
          workspaceTypes: [
            { id, provider },
            { id: staticId, provider: staticProvider },
          ],
        },
      }),
    },
    workspaceProviderRuntime: {
      find: async (_deps: unknown, input: { providerId: string }) => ({
        context: { projectId: "project" },
        provider: input.providerId === staticId ? staticProvider : provider,
      }),
    },
  } as unknown as WorkspacesRouteDeps;
  return { id, staticId, deps, select: (value: string | null | Error) => (revision = value) };
};

test("installed discovery refreshes project choices and supplies the create defaults", async () => {
  const fixture = discoveryFixture();
  expect((await listWorkspaceProviders(fixture.deps, "project"))[0]?.params.revision).toMatchObject({
    defaultValue: "main",
  });
  expect(await resolveWorkspaceParams(fixture.deps, "project", fixture.id, {})).toEqual({ revision: "main" });
  fixture.select("review");
  expect((await listWorkspaceProviders(fixture.deps, "project"))[0]?.params.revision).toMatchObject({
    defaultValue: "review",
  });
  expect(await resolveWorkspaceParams(fixture.deps, "project", fixture.id, {})).toEqual({ revision: "review" });
});

test("an unavailable installed provider is omitted and rejects creation without losing the catalog", async () => {
  const fixture = discoveryFixture();
  fixture.select(null);
  expect(await listWorkspaceProviders(fixture.deps, "project")).toMatchObject([
    { id: fixture.staticId, params: { revision: { defaultValue: "static-fallback" } } },
  ]);
  await expect(resolveWorkspaceParams(fixture.deps, "project", fixture.id, {})).rejects.toThrow(/unavailable/);
});

test("one failed discovery preserves the other provider choices", async () => {
  const fixture = discoveryFixture();
  fixture.select(new Error("Local tool unavailable"));
  expect((await listWorkspaceProviders(fixture.deps, "project")).map((item) => item.id)).toEqual([fixture.staticId]);
  expect(await resolveWorkspaceParams(fixture.deps, "project", fixture.staticId, {})).toEqual({
    revision: "static-fallback",
  });
});

test("provider semantic validation receives resolved defaults and rejects creation before allocating a workspace", async () => {
  const createStandalone = mock(async () => {
    throw new Error("Unexpected workspace allocation");
  });
  const validateParams = mock(async (ctx: { projectId: string }, input: { revision: string }) => {
    expect(ctx.projectId).toBe("project");
    expect(input).toEqual({ revision: "main" });
    throw new Error("Revision is unavailable");
  });
  const provider = { params: { revision: params.text({ defaultValue: "main" }) }, validateParams };
  const deps = {
    workspaceService: { getDefault: async () => null, createStandalone },
    workspaceProviderRuntime: { find: async () => ({ context: { projectId: "project" }, provider }) },
  } as never;
  await expect(
    createProviderBackedWorkspace(deps, { projectId: "project", providerId: "example.local", standalone: true }),
  ).rejects.toThrow(/Invalid params.*Revision is unavailable/);
  expect(validateParams).toHaveBeenCalledTimes(1);
  expect(createStandalone).not.toHaveBeenCalled();
});
