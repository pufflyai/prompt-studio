import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createExtensionFilesDBService } from "../services/extension-files/extension-files";
import { createExtensionInstancesDBService } from "../services/extension-instances/extension-instances";
import { createFilesDBService } from "../services/files/files";
import { createInstalledExtensionSourcesDBService } from "../services/installed-extension-sources/installed-extension-sources";
import { createProjectsDBService } from "../services/projects/projects";
import { createSkillsDBService } from "../services/skills/skills";
import { createDb } from "./connection.pglite";
import { prepareFileOwnersUpgrade } from "./file-owners-upgrade";
import { restoreReleasedPreferenceTables } from "./preference-upgrade.fixture";
import { prepareProjectExtensionsUpgrade } from "./project-extensions-upgrade";
import { files, skills } from "./schemas.pg";

const hash = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const interruptMappingExport = async (store: Awaited<ReturnType<typeof createDb>>, finish: () => Promise<void>) => {
  const path = store.path;
  const exports = `${path}-migration-exports`;
  await mkdir(exports, { recursive: true });
  await writeFile(join(exports, "file-mappings"), "blocked export directory");
  await expect(finish()).rejects.toThrow();
  expect(
    (await store.pglite.query<{ count: number }>("SELECT count(*)::int AS count FROM files WHERE owner IS NOT NULL"))
      .rows[0]!.count,
  ).toBeGreaterThan(0);
  expect(await Bun.file(`${path}-skill-files-upgrade.jsonl`).exists()).toBe(true);
  expect(await Bun.file(`${path}-extension-files-upgrade.jsonl`).exists()).toBe(true);
  await unlink(join(exports, "file-mappings"));
};

for (const interruption of ["normal", "schema", "restore", "mappings"])
  test(`released file bindings preserve independent contents after ${interruption}`, async () => {
    const root = await mkdtemp(join(tmpdir(), "file-owners-upgrade-"));
    const path = join(root, "database");
    let store: Awaited<ReturnType<typeof createDb>> | undefined;
    try {
      store = await createDb({ path });
      const project = await createProjectsDBService(store.db).create({ name: "Old files" });
      const stamp = "2026-11-20T12:00:00.000Z";
      const instances = [];
      for (const suffix of ["a", "b", "c"]) {
        const source = await createInstalledExtensionSourcesDBService(store.db).register({
          install_name: `files-${suffix}`,
          extension_id: "example.files",
          display_name: "Files",
          source_kind: "local_path",
          source_path: `/files-${suffix}`,
        });
        instances.push(
          await createExtensionInstancesDBService(store.db).create({
            installed_extension_id: source.id,
            scope_type: "project",
            scope_id: project.id,
            enabled: suffix === "a",
          }),
        );
      }
      const bytes = Buffer.alloc(5 * 1024 * 1024, 67);
      const metadata = (id: string, file_kind = "skill") => ({
        id,
        project_id: project.id,
        file_name: `${id}.md`,
        file_kind,
        storage_path: join(root, id),
        mime_type: "text/markdown",
        size_bytes: bytes.length,
        hash: hash(bytes),
        created_at: stamp,
        updated_at: stamp,
      });
      await mkdir(join(root, "uploads"));
      const originals = [
        ...Array.from({ length: 201 }, (_, i) => metadata(`file-${i}`)),
        metadata("shared"),
        metadata("host", "attachment"),
        metadata("missing", "attachment"),
      ];
      for (const file of originals) {
        if (file.id === "missing") continue;
        if (file.id !== "shared") {
          file.size_bytes = 4;
          file.hash = hash(Buffer.from("text"));
        }
        await writeFile(file.storage_path, file.id === "shared" ? bytes : "text");
      }
      await store.db.insert(files).values(originals);
      const names = [
        ...Array.from({ length: 201 }, (_, i) => `skill-${i}`),
        "shared-a",
        "shared-b",
        "host-skill",
        "missing-skill",
      ];
      await store.db.insert(skills).values(
        names.map((id) => ({
          id,
          name: id,
          project_id: project.id,
          description: id,
          created_at: stamp,
          updated_at: stamp,
        })),
      );
      await restoreReleasedPreferenceTables(store);
      await store.pglite.query(
        "INSERT INTO skill_files SELECT $1, 'skill-' || n, 'SKILL.md', 'file-' || n, $2, $2 FROM generate_series(0,200) n",
        [project.id, stamp],
      );
      await store.pglite.query("UPDATE skill_files SET path='' WHERE skill_id='skill-0'");
      const longPath = `${"nested/".repeat(70)}SKILL.md`;
      for (const [skill, file, target] of [
        ["shared-a", "shared", "SKILL.md"],
        ["shared-b", "shared", "SKILL.md"],
        ["host-skill", "host", longPath],
        ["missing-skill", "missing", "SKILL.md"],
      ])
        await store.pglite.query("INSERT INTO skill_files VALUES ($1,$2,$3,$4,$5,$5)", [
          project.id,
          skill,
          target,
          file,
          stamp,
        ]);
      for (const [id, instance, scope, file] of [
        ["ext-a", instances[0].id, "first", "shared"],
        ["ext-b", instances[1].id, "first", "shared"],
        ["ext-c", instances[2].id, "second", "shared"],
        ["ext-missing", instances[0].id, "missing", "missing"],
      ])
        await store.pglite.query("INSERT INTO extension_files VALUES ($1,$2,$3,$4,'resource',$5,$6)", [
          id,
          project.id,
          instance,
          file,
          scope,
          stamp,
        ]);
      const legacySkills = (await store.pglite.query("SELECT * FROM skill_files ORDER BY skill_id,path")).rows;
      const legacyExtensions = (await store.pglite.query("SELECT * FROM extension_files ORDER BY id")).rows;
      if (interruption !== "normal") {
        const finish = await prepareFileOwnersUpgrade(store.db, store.path);
        await prepareProjectExtensionsUpgrade(store.db, store.path);
        await migrate(store.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle") });
        if (interruption === "mappings") await interruptMappingExport(store, finish);
        if (interruption === "restore") {
          await store.pglite.exec(
            "CREATE FUNCTION fail_file_restore() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.owner = 'example.files' THEN RAISE EXCEPTION 'interrupt file restore'; END IF; RETURN NEW; END $$; CREATE TRIGGER interrupt_files BEFORE INSERT ON files FOR EACH ROW EXECUTE FUNCTION fail_file_restore()",
          );
          await expect(finish()).rejects.toThrow("Failed query");
          expect(await Bun.file(`${path}-skill-files-upgrade.jsonl`).exists()).toBe(true);
          expect(await Bun.file(`${path}-extension-files-upgrade.jsonl`).exists()).toBe(true);
          await store.pglite.exec("DROP TRIGGER interrupt_files ON files; DROP FUNCTION fail_file_restore()");
        }
      }
      await store.close();
      store = await createDb({ path });
      const skillService = createSkillsDBService(store.db);
      expect(await skillService.list(project.id)).toHaveLength(205);
      expect((await skillService.getByName(project.id, "skill-0"))!.files[0].path).toBe("");
      const first = (await skillService.getByName(project.id, "shared-a"))!.files[0].file_id;
      const second = (await skillService.getByName(project.id, "shared-b"))!.files[0].file_id;
      expect(first).not.toBe(second);
      const service = createExtensionFilesDBService(store.db);
      const scope = {
        project_id: project.id,
        extension_instance_id: instances[1].id,
        scope_type: "resource",
        scope_id: "first",
      };
      const firstScope = await service.list(scope);
      const secondScope = await service.list({ ...scope, scope_id: "second" });
      expect(firstScope).toHaveLength(1);
      expect(secondScope).toHaveLength(1);
      const copies = [first, second, firstScope[0].id, secondScope[0].id];
      expect(new Set(copies).size).toBe(4);
      const fileService = createFilesDBService(store.db);
      for (const id of copies) {
        const file = (await fileService.get(id))!;
        expect(hash(await readFile(file.storage_path))).toBe(hash(bytes));
        expect({ ...file, id: "shared", storage_path: join(root, "shared") }).toEqual(
          originals.find((row) => row.id === "shared")!,
        );
      }
      const host = (await skillService.getByName(project.id, "host-skill"))!;
      expect(host.files[0].path).toBe(longPath);
      expect(host.files[0].file_id).not.toBe("host");
      expect(await readFile(join(root, "host"), "utf8")).toBe("text");
      const missingSkill = (await fileService.get(
        (await skillService.getByName(project.id, "missing-skill"))!.files[0].file_id,
      ))!;
      const missingExtension = (await service.list({ ...scope, scope_id: "missing" }))[0];
      expect(missingSkill.storage_path).not.toBe(missingExtension.storage_path);
      expect(await Bun.file(missingSkill.storage_path).exists()).toBe(false);
      expect(await Bun.file(missingExtension.storage_path).exists()).toBe(false);
      const archive = async (name: string) =>
        (await Bun.file(`${path}-migration-exports/${name}.jsonl`).text())
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
      expect((await archive("skill-files")).map((row) => row.released)).toEqual(legacySkills);
      expect((await archive("extension-files")).map((row) => row.released)).toEqual(legacyExtensions);
      const mappings = await readdir(`${path}-migration-exports/file-mappings`);
      expect(mappings).toHaveLength(209);
      await fileService.remove(firstScope[0].id, () => unlink(firstScope[0].storage_path));
      expect(hash(await readFile(secondScope[0].storage_path))).toBe(hash(bytes));
      await store.close();
      store = await createDb({ path });
      expect((await createSkillsDBService(store.db).getByName(project.id, "shared-b"))!.files[0].file_id).toBe(second);
      expect(await readdir(`${path}-migration-exports/file-mappings`)).toHaveLength(mappings.length);
    } finally {
      await store?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
