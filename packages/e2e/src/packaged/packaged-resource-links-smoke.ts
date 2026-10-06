import { expect, test } from "bun:test";
import { type ChildProcess, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

export const registerResourceLinksSmokeTests = () => {
  test("independent extension resources share durable links through the packaged SDK, HTTP and CLI", async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-resource-links-"));
    let child: ChildProcess | undefined;
    try {
      let runtime = await startPackagedServe(root);
      child = runtime.child;
      const request = async (path: string, body: unknown) => {
        const response = await fetch(`${runtime.baseUrl}${path}`, {
          method: "POST",
          headers: { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const result = await response.json();
        expect(response.status, JSON.stringify(result)).toBeLessThan(300);
        return result;
      };
      const project = await request("/v1/projects", folderProjectInput({ name: "Resource links" }, root));
      for (const name of ["notes", "art"]) {
        const sourcePath = join(root, name);
        mkdirSync(sourcePath);
        writeFileSync(
          join(sourcePath, "package.json"),
          JSON.stringify({
            name,
            publisher: "test",
            version: "1.0.0",
            type: "module",
            main: "./extension.ts",
            engines: { pstdio: `^${EXTENSION_API_VERSION}` },
          }),
        );
        writeFileSync(
          join(sourcePath, "extension.ts"),
          `export default {
          resourceKinds: [{id:"item", ref:{kind:"resource-kind",id:"item"}}],
          commands: [
            {id:"link", ref:{kind:"command",id:"link"}, title:"Link", async run(ctx) { await ctx.resources.addAnchors({type:"item",id:"one"}, [{type:"item",id:"two",extensionId:"test.art",role:"result",metadata:{revision:2}}]); }},
            {id:"read", ref:{kind:"command",id:"read"}, title:"Read", async run(ctx) { return ctx.resources.listAnchors({resource:{type:"item",id:"two"},direction:"incoming"}); }},
            {id:"removed", ref:{kind:"command",id:"removed"}, title:"Removed", async run(ctx) { await ctx.resources.removed({type:"item",id:"two"}); }}
          ]
        };`,
        );
        await request(`/v1/projects/${project.id}/extensions/installed/${name}/enable`, {
          displayName: name,
          extensionId: `test.${name}`,
          name,
          manifest: { name },
          sourceKind: "local_path",
          sourcePath,
          sourceHash: null,
          sourceRef: null,
          version: null,
        });
      }
      const execute = (owner: string, command: string) =>
        request(`/v1/projects/${project.id}/extensions/commands/test.${owner}.command.${command}/execute`, {
          source: "api",
        });
      expect(await execute("notes", "link")).toMatchObject({ outcome: { ok: true } });
      expect(await execute("art", "read")).toMatchObject({
        outcome: {
          value: {
            items: [
              expect.objectContaining({
                source: expect.objectContaining({ extensionId: "test.notes" }),
                target: expect.objectContaining({ extensionId: "test.art", role: "result", metadata: { revision: 2 } }),
              }),
            ],
          },
        },
      });
      const from = JSON.stringify({ type: "item", id: "one", extensionId: "test.notes" });
      const to = JSON.stringify({ type: "item", id: "two", extensionId: "test.art" });
      const cli = (...args: string[]) => {
        const result = spawnSync(PACKAGED_BINARY_PATH, ["resources", ...args, "--project-id", project.id], {
          cwd: root,
          encoding: "utf8",
          env: { ...process.env, PSTDIO_HOME: root, PSTDIO_API_URL: runtime.baseUrl },
        });
        expect(result.status, result.stderr).toBe(0);
        return JSON.parse(result.stdout);
      };
      expect(cli("links", "--resource", to, "--direction", "incoming").items).toHaveLength(1);
      await stopProcess(child);
      child = undefined;
      runtime = await startPackagedServe(root);
      child = runtime.child;
      expect(cli("links", "--resource", from).items).toHaveLength(1);
      cli("unlink", "--from", from, "--to", to);
      expect(cli("links", "--resource", to, "--direction", "both").items).toEqual([]);
      cli("link", "--from", from, "--to", to, "--role", "source");
      expect(cli("links", "--resource", from).items[0].target.role).toBe("source");
      expect(await execute("art", "removed")).toMatchObject({ outcome: { ok: true } });
      expect(cli("links", "--resource", from).items).toEqual([]);
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
};
