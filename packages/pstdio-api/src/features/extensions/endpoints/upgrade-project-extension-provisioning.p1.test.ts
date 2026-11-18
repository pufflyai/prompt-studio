import { expect, test } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import { workspaceEvents } from "pstdio-api-contracts/extension-kernel";
import type { AppBindings } from "../../../types";
import { upgradeProjectExtensionHandler, upgradeProjectExtensionRoute } from "./upgrade-project-extension";

const requestUpgrade = async (input: {
  before?: "skills" | "hook" | "missing";
  enabledAfter?: boolean;
  after?: "skills" | "hook";
  enabled?: boolean;
  changed?: boolean;
  replacedDuringUpgrade?: boolean;
  sourceKind?: "git" | "registry";
}) => {
  let provisions = 0;
  let reads = 0;
  let upgraded = false;
  let availabilityChecks = 0;
  const installedSource = {
    id: "source",
    install_name: "notes",
    extension_id: "test.notes",
    name: "notes",
    display_name: "Notes",
    version: "2.0.0",
    source_path: "/extensions/notes",
    source_kind: input.sourceKind ?? "registry",
    source_ref: null,
    source_hash: "hash",
    status: "loaded",
    manifest_json: {},
    last_loaded_at: null,
    last_error_json: null,
  };
  const instance = {
    id: "instance",
    scope_id: "project",
    scope_type: "project",
    installed_extension_id: "source",
    enabled: input.enabled ?? true,
    config_json: {},
  };
  const app = new OpenAPIHono<AppBindings>();
  app.openapi(
    upgradeProjectExtensionRoute,
    upgradeProjectExtensionHandler({
      extensionService: {
        getProjectExtensionInstance: async () => ({
          instance: { ...instance, enabled: upgraded ? (input.enabledAfter ?? instance.enabled) : instance.enabled },
          installedSource:
            upgraded && input.replacedDuringUpgrade
              ? { ...installedSource, source_hash: "replacement" }
              : installedSource,
        }),
      },
      extensionUpgradeService: {
        upgrade: async () => {
          upgraded = true;
          return { instance, installedSource, changed: input.changed ?? true };
        },
        canUpgrade: async () => {
          availabilityChecks++;
          return true;
        },
      },
      extensionRuntimeCatalog: {
        getSourcesRuntime: async () => {
          const contribution = reads++ === 0 ? input.before : input.after;
          return {
            extensions: contribution === "missing" ? [] : [{}],
            diagnostics: [],
            skills: contribution === "skills" ? [{}] : [],
            hooks: contribution === "hook" ? [{ eventId: workspaceEvents.provision.id }] : [],
          };
        },
      },
      workspaceService: {
        list: async () => {
          provisions++;
          return [];
        },
      },
    } as never),
  );
  const response = await app.request("/projects/project/extensions/instance/upgrade", { method: "POST" });
  expect(response.status).toBe(200);
  expect(availabilityChecks).toBe(input.replacedDuringUpgrade ? 1 : 0);
  expect((await response.json()).extension.canUpgrade).toBe(input.replacedDuringUpgrade ?? false);
  return provisions;
};

test("does not prepare every workspace for an upgrade with no workspace contributions", async () => {
  expect(await requestUpgrade({})).toBe(0);
});
test("refreshes workspace files when an upgrade adds skills or removes existing skills", async () => {
  expect(await requestUpgrade({ after: "skills" })).toBe(1);
  expect(await requestUpgrade({ before: "skills" })).toBe(1);
});
test("refreshes workspaces when an upgraded extension provides a setup hook", async () => {
  expect(await requestUpgrade({ after: "hook" })).toBe(1);
});
test("does not prepare workspaces for an unchanged or disabled extension", async () => {
  expect(await requestUpgrade({ before: "skills", enabled: false })).toBe(0);
  expect(await requestUpgrade({ before: "skills", changed: false })).toBe(0);
});

test("repairs skills when the previous source could not be read or was enabled during installation", async () => {
  expect(await requestUpgrade({ before: "missing" })).toBe(1);
  expect(await requestUpgrade({ enabled: false, enabledAfter: true })).toBe(1);
  expect(await requestUpgrade({ before: "skills", enabledAfter: false })).toBe(0);
});

test("acknowledges the installed Git release immediately and checks availability for a concurrent replacement", async () => {
  await requestUpgrade({ sourceKind: "git" });
  await requestUpgrade({ sourceKind: "git", replacedDuringUpgrade: true });
});
