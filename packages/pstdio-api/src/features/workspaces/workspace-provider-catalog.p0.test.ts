import { describe, expect, test } from "bun:test";
import { workspaceProviderDescriptorSchema } from "pstdio-api-contracts";
import type { WorkspacesRouteDeps } from "./deps";
import { listWorkspaceProviders } from "./workspace-provider-catalog";

const providerCatalog = () =>
  ({
    extensionRuntimeCatalog: { get: async () => ({ runtime: { workspaceTypes: [] } }) },
  }) as unknown as WorkspacesRouteDeps;

describe("installed workspace provider catalog", () => {
  test("does not hide extension discovery failures when Git discovery also fails", async () => {
    const failure = new Error("Extension catalog unavailable");
    const deps = {
      ...providerCatalog(),
      extensionRuntimeCatalog: {
        get: async () => {
          throw failure;
        },
      },
    } as unknown as WorkspacesRouteDeps;

    await expect(listWorkspaceProviders(deps, "project-1")).rejects.toBe(failure);
  });

  test("preserves provider-declared choices without a Git source", async () => {
    const params = {
      image: { type: "select", defaultValue: "ubuntu", options: [{ label: "Ubuntu", value: "ubuntu" }] },
    };
    const deps = {
      ...providerCatalog(),
      extensionRuntimeCatalog: {
        get: async () => ({
          runtime: {
            workspaceTypes: [{ id: "example.cloud", provider: { label: "Cloud", icon: "rocket", params } }],
          },
        }),
      },
    } as unknown as WorkspacesRouteDeps;

    const providers = await listWorkspaceProviders(deps, "project-1");
    expect(providers.map((provider) => workspaceProviderDescriptorSchema.parse(provider))).toMatchObject([
      { id: "example.cloud", icon: "rocket", params },
    ]);
  });
});
