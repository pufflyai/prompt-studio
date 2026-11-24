import { expect, test } from "bun:test";
import type { ExtensionConnectionsApi } from "@pstdio/sdk/extensions";
import { makeCommandContext } from "@pstdio/sdk/testing";
import { stopAllEnvironments, stopEnvironmentCommand } from "./commands";
import type { Environment } from "./environments";
import { createRunStorage as createMemoryStorage } from "./run-storage-fixture";
import { environmentsView } from "./workbench";

const environment = (id: string, purpose: string, project = "owned", state = "ready"): Environment => ({
  id,
  external_id: id,
  state,
  reason_code: null,
  change_cursor: 0,
  created_at: "2026-01-01T00:00:00Z",
  deadline_at: null,
  template: { name: id, version: "1" },
  failure: null,
  metadata: { purpose, pstdio_project_id: project },
});

test.each(["view", "cli", "toolbar"])("project preview environments remain manageable through %s", async (surface) => {
  const stopped: string[] = [];
  const request: ExtensionConnectionsApi["request"] = async <TBody>(
    _id: string,
    input: Parameters<ExtensionConnectionsApi["request"]>[1],
  ) => {
    if (input.method === "POST") {
      stopped.push(input.path);
      return { status: 200, headers: {}, body: { id: input.path.split("/")[3], state: "canceled" } as TBody };
    }
    const next = input.path.includes("cursor=next");
    return {
      status: 200,
      headers: {},
      body: {
        items: next
          ? [environment("preview", "pstdio-preview"), environment("ended", "pstdio-preview", "owned", "succeeded")]
          : [
              environment("tests", "remote-testing"),
              environment("foreign", "pstdio-preview", "other"),
              environment("unrelated", "another-tool"),
            ],
        next_cursor: next ? null : "next",
      } as TBody,
    };
  };
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    projectId: "owned",
    params: {},
    overrides: {
      connections: { request },
      settings: { all: async () => ({ templateVersion: "1", storageBucket: "fixture", signerAccount: "fixture" }) },
    },
  });
  if (surface === "view") {
    const table = await environmentsView.body.query(ctx);
    expect(table.rows.map((row) => row.id)).toEqual(["tests", "preview"]);
    expect(stopped).toEqual([]);
  } else {
    if (surface === "cli") await stopEnvironmentCommand.run(ctx, { all: true });
    else expect(await stopAllEnvironments.run(ctx, {})).toEqual({ stopped: 2 });
    expect(stopped).toEqual(["/v1/workspaces/tests/cancel", "/v1/workspaces/preview/cancel"]);
  }
});
