import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import type { AppBindings } from "../../types";

export const RUNTIME_TOKEN = "runtime-test-token";
export const COMMAND_ID = "pstdio.automation-test.command.launch";
export const BLOCKING_COMMAND_ID = "pstdio.automation-test.command.blocking";
export const INSPECT_COMMAND_ID = "pstdio.automation-test.command.inspect";
export const LARGE_RESULT_COMMAND_ID = "pstdio.automation-test.command.large-result";
export const LARGE_ERROR_COMMAND_ID = "pstdio.automation-test.command.large-error";
export const PROVISION_COMMAND_ID = "pstdio.automation-test.command.provision";

export const requestWithToken = (app: OpenAPIHono<AppBindings>, token: string, path: string, init: RequestInit = {}) =>
  app.request(path, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...Object.fromEntries(new Headers(init.headers).entries()) },
  });

export const issueAutomationToken = async (
  request: (path: string, init?: RequestInit) => Response | Promise<Response>,
  projectId: string,
  commandScopes = [COMMAND_ID],
) => {
  const response = await request("/v1/auth/tokens", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "notion-launcher", projectId, commandScopes, expiresInSeconds: 3600 }),
  });
  if (response.status !== 201) throw new Error(`Machine token issue failed with HTTP ${response.status}.`);
  return response.json() as Promise<{ token: string }>;
};

export const writeAutomationExtension = (root: string) => {
  const extensionRoot = join(root, "extensions", "automation-test");
  mkdirSync(extensionRoot, { recursive: true });
  writeFileSync(
    join(extensionRoot, "package.json"),
    JSON.stringify({
      name: "automation-test",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
    }),
  );
  writeFileSync(
    join(extensionRoot, "extension.ts"),
    `let cancelledSideEffect = false;
    let providerCreateStarted = false;
    let providerCancelCount = 0;
    export default {
      workspaceTypes: [
        {
          id: "remote",
          ref: { kind: "workspace-type", id: "remote" },
          label: "Remote",
          async create(_ctx, input) {
            providerCreateStarted = true;
            await Promise.race([
              new Promise((resolve) => input.signal?.addEventListener("abort", resolve, { once: true })),
              new Promise((resolve) => setTimeout(resolve, 200)),
            ]);
            return {
              providerRef: { version: 1, data: { remoteId: input.workspaceId } },
              state: "ready",
              executionKind: "remote",
              executionTarget: {
                kind: "remote",
                providerId: "pstdio.automation-test.workspace-type.remote",
                providerRef: { version: 1, data: { remoteId: input.workspaceId } },
              },
              capabilities: { files: "none", diff: false, merge: false, rebase: false, archive: true, delete: true },
            };
          },
          async resolve(_ctx, input) {
            return {
              providerRef: input.providerRef,
              state: "ready",
              executionKind: "remote",
              executionTarget: {
                kind: "remote",
                providerId: "pstdio.automation-test.workspace-type.remote",
                providerRef: input.providerRef,
              },
              capabilities: { files: "none", diff: false, merge: false, rebase: false, archive: true, delete: true },
            };
          },
          async cancel(_ctx, input) {
            providerCancelCount += 1;
            return {
              providerRef: input.providerRef,
              state: "cancelled",
              executionKind: "remote",
              capabilities: { files: "none", diff: false, merge: false, rebase: false, archive: true, delete: true },
            };
          },
        },
      ],
      harnesses: [
        {
          id: "remote-agent",
          ref: { kind: "harness", id: "remote-agent" },
          label: "Remote agent",
          cwdRequirement: "optional",
          capabilities: () => [],
          detect: () => ({ available: true }),
          start: () => ({
            agentSessionId: crypto.randomUUID(),
            done: Promise.resolve({ status: "completed" }),
            stop: () => {},
          }),
          resume: () => ({
            done: Promise.resolve({ status: "completed" }),
            stop: () => {},
          }),
        },
      ],
      commands: [
        {
          id: "launch",
          ref: { kind: "command", id: "launch" },
          title: "Launch",
          automation: true,
          params: { amount: { type: "number", required: true } },
          async run(ctx, params) {
            const count = (await ctx.storage.get("count") ?? 0) + params.amount;
            await ctx.storage.set("count", count);
            return { count };
          },
        },
        {
          id: "blocking",
          ref: { kind: "command", id: "blocking" },
          title: "Blocking",
          automation: true,
          async run(ctx) {
            await new Promise((resolve, reject) => {
              if (ctx.signal.aborted) return reject(ctx.signal.reason);
              ctx.signal.addEventListener("abort", () => reject(ctx.signal.reason), { once: true });
            });
            cancelledSideEffect = true;
          },
        },
        {
          id: "provision",
          ref: { kind: "command", id: "provision" },
          title: "Provision",
          automation: true,
          async run(ctx) {
            const workspace = await ctx.workspaces.create({
              project_id: ctx.projectId,
              shorthand_base: "remote",
              provider_id: "pstdio.automation-test.workspace-type.remote",
            });
            await ctx.sessions.create({
              title: "Remote automation session",
              prompt: "Run remotely",
              workspaceId: workspace.id,
              harness: { harnessId: "pstdio.automation-test.harness.remote-agent" },
            });
          },
        },
        {
          id: "inspect",
          ref: { kind: "command", id: "inspect" },
          title: "Inspect",
          async run(ctx) {
            return {
              cancelledSideEffect,
              providerCreateStarted,
              providerCancelCount,
              sessionCount: (await ctx.sessions.list()).length,
            };
          },
        },
        {
          id: "large-result",
          ref: { kind: "command", id: "large-result" },
          title: "Large result",
          automation: true,
          async run() { return { payload: "å".repeat(33_000) }; },
        },
        {
          id: "large-error",
          ref: { kind: "command", id: "large-error" },
          title: "Large error",
          automation: true,
          async run() { throw new Error("å".repeat(5_000)); },
        },
        {
          id: "private",
          ref: { kind: "command", id: "private" },
          title: "Private",
          async run() { return { private: true }; },
        },
      ],
    };`,
  );
  return extensionRoot;
};
