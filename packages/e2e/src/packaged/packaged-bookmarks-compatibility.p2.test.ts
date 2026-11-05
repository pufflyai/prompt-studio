import { expect, test } from "bun:test";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { installBuiltSdk } from "../helpers/installed-sdk";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();
interface Bookmark {
  id: string;
  title: string;
  url: string;
  read: boolean;
}

test(
  "unchanged Bookmarks commands and table retain collection edits on the candidate API host and SDK",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-bookmarks-compatibility-"));
    const source = join(root, "bookmarks");
    cpSync(join(import.meta.dir, "../../../../infra/local/extensions/bookmarks"), source, {
      recursive: true,
      filter: (path) => basename(path) !== "node_modules",
    });
    // Only the copied dependency declaration changes. All production callers and view definitions stay intact.
    installBuiltSdk(source);
    const sdk = await Bun.file(join(source, "node_modules/@pstdio/sdk/package.json")).json();
    console.log(JSON.stringify({ compatibility: "unchanged-bookmarks", sdk: sdk.version, api: EXTENSION_API_VERSION }));
    const env = {
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source, installName: "bookmarks", skipInstall: true }]),
    };
    let host: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
    try {
      host = await startPackagedServe(root, env);
      const post = (path: string, body: unknown) =>
        fetch(`${host!.baseUrl}/v1${path}`, {
          method: "POST",
          headers: { ...runtimeAuthorization(host!.descriptor), "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      const created = await post("/projects", folderProjectInput({ name: "Bookmarks compatibility" }, root));
      expect(created.status).toBe(201);
      const project = (await created.json()) as { id: string };
      const execute = async <T>(id: string, params: object = {}, query = false) => {
        const suffix = query ? "view.bookmark-table.dataTable.query" : `command.${id}`;
        const response = await post(`/projects/${project.id}/extensions/commands/acme.bookmarks.${suffix}/execute`, {
          params,
          source: "api",
        });
        const body = (await response.json()) as { outcome: { ok: boolean; value: T } };
        expect(response.status, JSON.stringify(body)).toBe(200);
        expect(body.outcome).toMatchObject({ ok: true });
        return body.outcome.value;
      };
      const table = () => execute<{ rows: { id: string; values: Omit<Bookmark, "id"> }[] }>("", {}, true);
      const added = await execute<Bookmark>("add", { title: "Retained bookmark", url: "https://example.com/kept" });
      expect(await execute<Bookmark[]>("list")).toEqual([added]);
      expect((await table()).rows).toEqual([
        { id: added.id, values: { title: added.title, url: added.url, read: false } },
      ]);
      expect(await execute<Bookmark>("toggle-read", { rowId: added.id })).toEqual({ ...added, read: true });
      expect(await execute<Bookmark[]>("list", { unread: true })).toEqual([]);
      expect((await table()).rows[0]!.values.read).toBe(true);
      await stopProcess(host.child);
      host = await startPackagedServe(root, env);
      expect(await execute<Bookmark[]>("list")).toEqual([{ ...added, read: true }]);
      expect((await table()).rows[0]!.values.read).toBe(true);
      expect(await execute("delete", { rowIds: [added.id] })).toEqual({ deleted: [added.id] });
      expect(await execute<Bookmark[]>("list")).toEqual([]);
      expect((await table()).rows).toEqual([]);
      await stopProcess(host.child);
      host = await startPackagedServe(root, env);
      expect(await execute<Bookmark[]>("list")).toEqual([]);
    } finally {
      if (host) await stopProcess(host.child);
      rmSync(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
