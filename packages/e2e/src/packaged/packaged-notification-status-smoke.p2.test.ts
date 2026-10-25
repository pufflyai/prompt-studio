import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();

test(
  "packaged notification status keeps SDK parity, project scope and legacy transitions",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-notification-status-"));
    let host: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
    try {
      host = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
      const headers = runtimeAuthorization(host.descriptor);
      const response = await fetch(`${host.baseUrl}/v1/projects`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Notification status" })),
      });
      expect(response.status).toBe(201);
      const project = await response.json();
      const client = createClient({ baseUrl: host.baseUrl, token: host.descriptor.token });
      const sourcePath = join(root, "extension");
      await Bun.write(
        join(sourcePath, "package.json"),
        JSON.stringify({
          name: "notification-status",
          publisher: "test",
          version: "1.0.0",
          type: "module",
          main: "./extension.ts",
          engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        }),
      );
      await Bun.write(
        join(sourcePath, "extension.ts"),
        `export default {
          commands: [{ id: "status", ref: { kind: "command", id: "status" }, title: "Set status",
            run(ctx, params) {
              if (params.key !== undefined) return ctx.notify.setStatusByKey(params.key, params.status);
              return ctx.notify.setStatus(params.id, params.status);
            }
          }]
        };`,
      );
      await client.extensions.enableInstalled(project.id, "notification-status", {
        displayName: "Notification status",
        extensionId: "test.notification-status",
        name: "notification-status",
        manifest: { name: "notification-status" },
        sourceKind: "local_path",
        sourcePath,
        sourceHash: null,
        sourceRef: null,
        version: null,
      });
      const execute = async (params: Record<string, string>) => {
        const response = await client.extensions.execute("test.notification-status.command.status", {
          projectId: project.id,
          params,
        });
        expect(response.outcome.status).toBe("success");
        if (response.outcome.status !== "success") throw new Error(JSON.stringify(response.outcome));
        return response.outcome.value;
      };
      const notification = await client.notifications.create({
        projectId: project.id,
        title: "Review",
        kind: "needs_review",
        dedupeKey: "review",
      });
      const done = await client.notifications.setStatus(project.id, notification.id, { status: "done" });
      expect(done).toMatchObject({ status: "done" });
      expect(await execute({ id: notification.id, status: "done" })).toEqual(done);
      expect(await execute({ key: "review", status: "done" })).toEqual([done]);
      const expired = await client.extensions.execute("test.notification-status.command.status", {
        projectId: project.id,
        params: { id: notification.id, status: "expired" },
      });
      expect(expired.outcome.status).toBe("error");
      expect(await client.notifications.get(project.id, notification.id)).toEqual(done);
      expect(await client.notifications.setStatusByKey(project.id, "review", { status: "done" })).toEqual([done]);
      expect(await client.notifications.markDone(project.id, notification.id)).toEqual(done);
      expect(await client.notifications.setStatus("other", notification.id, { status: "dismissed" })).toBeNull();
      expect(await client.notifications.setStatusByKey(project.id, "missing", { status: "done" })).toEqual([]);
    } finally {
      if (host) await stopProcess(host.child);
      rmSync(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
