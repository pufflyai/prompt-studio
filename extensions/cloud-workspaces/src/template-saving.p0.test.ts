import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { catalogPathFor, listCatalog, templateDirectory } from "./template-catalog";
import { saveTemplate } from "./template-commands";

const manifest = (name = "worker", version = "1.0.0") => ({
  apiVersion: "pocketcoder.dev/v1",
  kind: "Template",
  metadata: { name },
  spec: { version },
});

function fixture() {
  const files = createMemoryRepoFiles();
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: { projectFiles: files },
  });
  return { files, ctx };
}

test.each([
  JSON.stringify(manifest()),
  "apiVersion: pocketcoder.dev/v1\nkind: Template\nmetadata:\n  name: worker\nspec:\n  version: 1.0.0\n",
  "{apiVersion: pocketcoder.dev/v1, kind: Template, metadata: {name: worker}, spec: {version: 1.0.0}}",
])("save accepts JSON, block YAML and flow YAML (%s)", async (source) => {
  const { ctx, files } = fixture();
  const result = await saveTemplate.run(ctx, { source });
  expect(JSON.parse(await files.readText(result.path))).toEqual(manifest());
});

test("different template identities remain independently selectable", async () => {
  const { ctx, files } = fixture();
  const identities = [manifest("worker-1.0.0", "2.0.0"), manifest("worker", "1.0.0-2.0.0")];
  const saved = [];
  for (const template of identities) saved.push(await saveTemplate.run(ctx, { source: JSON.stringify(template) }));
  expect(saved[0]?.path).not.toBe(saved[1]?.path);
  expect(await listCatalog(files)).toHaveLength(2);
  for (const [index, template] of identities.entries()) {
    expect(await catalogPathFor(files, template.metadata.name, template.spec.version)).toBe(saved[index]?.path);
  }
});

test("saving an existing catalog identity updates its original path", async () => {
  const { ctx, files } = fixture();
  const path = `${templateDirectory}/worker-1.0.0.json`;
  await files.writeText(path, JSON.stringify(manifest()));
  const updated = { ...manifest(), metadata: { name: "worker", description: "Updated" } };
  expect((await saveTemplate.run(ctx, { source: JSON.stringify(updated) })).path).toBe(path);
  expect(await listCatalog(files)).toHaveLength(1);
  expect(JSON.parse(await files.readText(path))).toEqual(updated);
});
