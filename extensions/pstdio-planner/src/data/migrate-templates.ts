import type { ExtensionContextBase, JsonObject } from "@pstdio/sdk/extensions";

type MigrationContext = Pick<ExtensionContextBase, "files" | "storage">;

const ownedTypes = new Set(["document", "prompt", "ticket"]);
const normalizeName = (name: string) => name.replaceAll("_", "-");

const normalizeRecords = (records: JsonObject[], key: string) => {
  const seen = new Set<string>();
  return records.map((record) => {
    const original = record[key];
    if (typeof original !== "string" || !original) throw new Error("Invalid legacy template name.");
    const name = normalizeName(original);
    if (seen.has(name)) throw new Error(`Cannot import colliding legacy template names: ${name}`);
    seen.add(name);
    return { name, record };
  });
};

const importTemplates = async (ctx: MigrationContext, templates: ReturnType<typeof normalizeRecords>) => {
  const collection = ctx.storage.collection("templates");
  for (const { name, record } of templates) {
    if (await collection.get(name)) continue;
    if (typeof record.file_id !== "string") throw new Error("Invalid legacy template file.");
    const content = await ctx.files.readText(record.file_id);
    const attachments = collection.attachments(name);
    const blob = await attachments.put({
      name: `${name}.md`,
      data: new TextEncoder().encode(content),
      mimeType: "text/markdown",
    });
    try {
      const created = await collection.createIfAbsent(name, {
        name,
        title: name,
        type: record.template_type,
        blobId: blob.id,
      });
      if (!created) await attachments.delete(blob.id);
    } catch (error) {
      await attachments.delete(blob.id).catch(() => undefined);
      throw error;
    }
  }
};

const importPreferences = async (ctx: MigrationContext, overrides: ReturnType<typeof normalizeRecords>) => {
  const collection = ctx.storage.collection("template-preferences");
  for (const { name, record } of overrides) {
    if (typeof record.enabled !== "boolean") throw new Error("Invalid legacy template preference.");
    await collection.createIfAbsent(name, {
      enabled: record.enabled,
      displayName: record.display_name_override ?? null,
      metadata: record.metadata_json ?? null,
    });
  }
};

const importDefaults = async (
  ctx: MigrationContext,
  records: JsonObject[],
  templates: ReturnType<typeof normalizeRecords>,
) => {
  const previous = (await ctx.storage.get<Record<string, string>>("template-defaults")) ?? {};
  const imported: Record<string, string> = {};
  for (const record of records) {
    if (typeof record.template_type !== "string" || !ownedTypes.has(record.template_type)) continue;
    const template = templates.find((entry) => entry.record.id === record.template_id);
    const name = record.source === "extension_template" ? record.template_key : template?.name;
    if (typeof name !== "string") throw new Error("Invalid legacy template default.");
    imported[record.template_type] = normalizeName(name);
  }
  if (Object.keys(imported).length) await ctx.storage.set("template-defaults", { ...imported, ...previous });
};

export const importLegacyTemplates = async (ctx: MigrationContext) => {
  const [source, preferences, defaults] = await Promise.all([
    ctx.storage.readLegacy("templates"),
    ctx.storage.readLegacy("extension_template_preferences"),
    ctx.storage.readLegacy("project_template_defaults"),
  ]);
  const owned = (source?.records ?? []).filter(
    (row) => typeof row.template_type === "string" && ownedTypes.has(row.template_type) && row.deleted_at == null,
  );
  const templates = normalizeRecords(owned, "name");
  const overrides = normalizeRecords(preferences?.records ?? [], "template_key");
  await importTemplates(ctx, templates);
  await importPreferences(ctx, overrides);
  await importDefaults(ctx, defaults?.records ?? [], templates);
};
