import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { runPackagedAsync } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { writeRegistryNotes } from "./registry-notes.fixture";
import { startRegistryService } from "./registry-service.fixture";
import { startRegistryWireFixture } from "./registry-wire.fixture";

export const registerIndependentExtensionSmokeTests = () => {
  test("a packaged host packs, installs and upgrades an independently published extension without changing host version", async () => {
    const root = await mkdtemp(join(tmpdir(), "packaged-independent-extensions-"));
    const registry =
      process.env.PSTDIO_PSX_REAL_SERVICE === "1" ? await startRegistryService() : await startRegistryWireFixture();
    let host: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
    let registryClosed = false;
    try {
      const source = join(root, "notes");
      const home = join(root, "host");
      const repo = join(root, "project");
      for (const dir of [home, repo]) await mkdir(dir);
      const publish = async (version: string) => {
        await writeRegistryNotes(source, version);
        const output = await runPackagedAsync(["extensions", "pack", source, "--out-dir", root], root, {
          PSTDIO_HOME: home,
        });
        const path = output.trim();
        expect(path).toBe(join(root, `pstdio.pstdio-notes-${version}.tgz`));
        await registry.publish(path);
      };
      const before = await runPackagedAsync(["--version"], root, { PSTDIO_HOME: home });
      await publish("0.45.1");
      host = await startPackagedServe(home, { PSTDIO_EXTENSION_RELEASE_REF: `psx:${registry.origin}` });
      const response = await fetch(`${host.baseUrl}/v1/projects`, {
        method: "POST",
        headers: { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Independent Extensions" }, repo)),
      });
      expect(response.status).toBe(201);
      const project = (await response.json()) as { id: string };
      const env = { PSTDIO_HOME: home, PSTDIO_API_URL: host.baseUrl, PSTDIO_API_TOKEN: host.descriptor.token };
      await runPackagedAsync(["extensions", "add", "pstdio.pstdio-notes"], repo, env);
      expect(
        await runPackagedAsync(["pstdio.pstdio-notes", "version", "--project-id", project.id], repo, env),
      ).toContain("0.45.1");
      await publish("0.45.2");
      expect(
        await runPackagedAsync(["extensions", "update", "pstdio-notes", "--project-id", project.id], repo, env),
      ).toContain("0.45.2");
      expect(
        await runPackagedAsync(["pstdio.pstdio-notes", "version", "--project-id", project.id], repo, env),
      ).toContain("0.45.2");
      expect(await runPackagedAsync(["--version"], root, { PSTDIO_HOME: home })).toBe(before);
      await registry.close();
      registryClosed = true;
      await runPackagedAsync(
        ["extensions", "add", join(root, "pstdio.pstdio-notes-0.45.1.tgz"), "--name", "pstdio-notes", "--force"],
        repo,
        env,
      );
      expect(
        await runPackagedAsync(["pstdio.pstdio-notes", "version", "--project-id", project.id], repo, env),
      ).toContain("0.45.1");
      const manifestPath = join(source, "package.json");
      const manifest = JSON.parse(await Bun.file(manifestPath).text());
      await Bun.write(manifestPath, JSON.stringify({ ...manifest, publisher: "con" }));
      const portablePackage = (
        await runPackagedAsync(["extensions", "pack", source, "--out-dir", root], root, env)
      ).trim();
      expect(portablePackage).toBe(join(root, "_con.pstdio-notes-0.45.2.tgz"));
      await runPackagedAsync(["extensions", "add", portablePackage], repo, env);
      expect(await runPackagedAsync(["con.pstdio-notes", "version", "--project-id", project.id], repo, env)).toContain(
        "0.45.2",
      );
    } finally {
      if (host) await stopProcess(host.child);
      if (!registryClosed) await registry.close();
      await rm(root, { recursive: true, force: true });
    }
  });
};
