import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { StackApi } from "pstdio-scripts/testing";
import * as Y from "yjs";
import type { ProjectUpgradeInput } from "./project-upgrade-fixture";

const historical = "pstdio.pstdio-home";
const canonical = "pstdio.home";

// Only open the disposable baseline after its process exits. Opening via createDb would run
// the checkout's migrations before the candidate binary got to see the original history.
export const checkHomeHistory = async (input: ProjectUpgradeInput, project: string, phase: "seed" | "verify") => {
  const path = join(input.home, "pstdio.db");
  await access(join(path, "PG_VERSION"));
  const icu = join(dirname(require.resolve("@electric-sql/pglite-icu-full")), "icu.76.tgz");
  const db = new PGlite(path, { database: "template1", username: "postgres", icuDataDir: Bun.file(icu) });
  try {
    const source = await db.query<{ extension_id: string }>(
      "SELECT DISTINCT s.extension_id FROM installed_extension_sources s JOIN extension_instances i ON i.installed_extension_id = s.id WHERE i.scope_id = $1 AND i.enabled AND s.extension_id IN ($2, $3)",
      [project, historical, canonical],
    );
    assert.equal(source.rows.length, 1, "Expected one enabled Home identity in the upgrade fixture");
    if (phase === "verify") assert.equal(source.rows[0]!.extension_id, canonical, "Home must use its active identity");
    const owners = input.profile === "aged" ? [historical, canonical] : [source.rows[0]!.extension_id];
    for (const [index, owner] of owners.entries()) {
      const key = JSON.stringify(["text-file", `upgrade-home-${index}`]);
      const content = `Saved Home history ${index} — résumé`;
      const document = new Y.Doc();
      try {
        if (phase === "seed") {
          document.getText("content").insert(0, content);
          await db.query(
            "INSERT INTO storage_documents (workbench_id, extension_id, document_id, state, revision) VALUES ($1, $2, $3, $4, 1)",
            [project, owner, key, Y.encodeStateAsUpdate(document)],
          );
        } else {
          const { rows } = await db.query<{ state: Uint8Array }>(
            "SELECT state FROM storage_documents WHERE workbench_id = $1 AND extension_id = $2 AND document_id = $3",
            [project, canonical, key],
          );
          assert.equal(rows.length, 1, `Active Home lost access to ${key} after upgrade`);
          Y.applyUpdate(document, rows[0]!.state);
          assert.equal(document.getText("content").toString(), content, `Home changed ${key}`);
        }
      } finally {
        document.destroy();
      }
    }
  } finally {
    await db.close();
  }
};

export const assertHomeOpens = async (api: StackApi, project: string) => {
  const home = await api.command<{ project: { id: string } }>(project, "pstdio.home.command.read");
  assert.equal(home.project.id, project, "Home must open the upgraded project");
};
