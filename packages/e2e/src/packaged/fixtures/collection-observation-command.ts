import { defineCommand } from "@pstdio/sdk/extensions";

export const collectionObservation = defineCommand({
  id: "collection-observation",
  title: "Exercise observed collection updates",
  async run(ctx) {
    const collection = ctx.storage.collection<{ title: string; position?: string }>("observations");
    await collection.put("a", { title: "Original" });
    const old = (await collection.read("a"))!;
    await collection.update("a", { title: "Newer title" });
    const stale = await collection.updateIfUnchanged("a", old.revision, { ...old.value, position: "position" });
    const current = (await collection.read("a"))!;
    const saved = await collection.updateIfUnchanged("a", current.revision, { ...current.value, position: "position" });
    return { stale, saved, migrationAllowed: await ctx.storage.canMigrate(), value: await collection.get("a") };
  },
});
