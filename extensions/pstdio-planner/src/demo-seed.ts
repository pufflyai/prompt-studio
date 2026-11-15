import { defineCommand, params } from "@pstdio/sdk/extensions";
import { migratePlannerStorage } from "./data/migrate-storage";
import { seedDefaultStatuses } from "./data/seed";
import { plannerTicketsChanged } from "./events";

type Marker = { id: string; shorthand: string; position: string; index: number };
export const demoSeed = defineCommand({
  id: "demo-seed",
  title: "Seed isolated performance demo",
  cli: true,
  mutating: true,
  params: {
    offset: params.number({ required: true }),
    part: params.number({ required: true }),
  },
  async run(ctx, { offset, part }) {
    if (!Number.isInteger(offset) || offset < 0 || offset >= 5000 || offset % 50) throw Error("Invalid offset");
    if (!Number.isInteger(part) || part < 0 || part > 4) throw Error("Invalid part");
    await migratePlannerStorage(ctx);
    await seedDefaultStatuses(ctx.storage);
    const records = ctx.storage.collection("tickets");
    const key = `demo-seed-page:${offset}`;
    let markers = await ctx.storage.get<Marker[]>(key);
    const fresh = new Set<string>();
    if (!markers) {
      markers = [];
      const previousPage = offset ? await ctx.storage.get<Marker[]>(`demo-seed-page:${offset - 50}`) : undefined;
      let previous =
        previousPage?.at(-1) ?? (offset ? await ctx.storage.get<Marker>(`demo-seed:${offset - 1}`) : undefined);
      for (let i = offset; i < Math.min(offset + 50, 5000); i++) {
        const old = await ctx.storage.get<Marker>(`demo-seed:${i}`);
        const identity = old ?? (await ctx.resources.allocate({ kind: "ticket" }));
        const marker = {
          ...identity,
          index: i,
          position: old?.position ?? ctx.storage.positions.between(previous?.position),
        };
        if (!old) fresh.add(marker.id);
        markers.push(marker);
        previous = marker;
      }
      await ctx.storage.set(key, markers);
    }
    const selected = markers.slice(part * 10, part * 10 + 10);
    for (let start = 0; start < selected.length; start += 8) {
      await Promise.all(
        selected.slice(start, start + 8).map(async (marker) => {
          if (!fresh.has(marker.id) && (await records.get(marker.id))) return;
          const i = marker.index;
          const title = (i >= 4975 ? "Demo focus " : "Demo background ") + String(i + 1).padStart(4, "0");
          await records.put(marker.id, {
            id: marker.id,
            title,
            content: `# ${title}\n\n${"Demo ticket content. ".repeat(420)}`,
            statusId: i < 205 ? "done" : ["backlog", "ready", "in-progress", "blocked", "in-review"][i % 5],
            tags: {},
            attachments: [],
            files: [],
            reviewLinks: [],
            parentId: null,
            dependsOn: [],
            blockedReason: null,
            userPrompt: null,
            draft: false,
            archived: false,
            position: marker.position,
            createdAt: "2026-11-01T12:00:00.000Z",
            updatedAt: "2026-11-01T12:00:00.000Z",
          });
        }),
      );
    }
    if (offset + part * 10 + 10 >= 5000) await ctx.events.emit(plannerTicketsChanged, {});
    return { next: Math.min(offset + part * 10 + 10, 5000), saved: selected };
  },
});
