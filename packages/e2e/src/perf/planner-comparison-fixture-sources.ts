// Public extension sources installed only into disposable comparison projects.
export const legacyFoobar = `import { defineCommand, defineExtension, defineNavigationItem, definePage, defineResourceKind, defineView, eventRef, params, workbenchModes } from "@pstdio/sdk/extensions";
const changed = eventRef({ extensionId: "demo.foobar", id: "changed" });
const seed = defineCommand({
  id: "seed", title: "Seed Foobar demo", cli: true, mutating: true,
  params: { offset: params.number({ required: true }) },
  async run(ctx, { offset }) {
    if (!Number.isInteger(offset) || offset < 0 || offset >= 5000) throw Error("Invalid offset");
    const edits = Array.from({ length: Math.min(10, 5000 - offset) }, (_, k) => {
      const i = offset + k;
      const id = "foobar-" + String(i + 1).padStart(4, "0");
      return { recordId: ctx.storage.records.id(id), replace: {
        id, title: (i >= 4975 ? "Foobar focus " : "Foobar background ") + String(i + 1).padStart(4, "0"),
        status: ["Todo", "In Progress", "Done"][i % 3], body: "Foobar resource content. ".repeat(350),
      } };
    });
    await ctx.storage.records.commit({ operationId: "demo-seed-ten-" + offset, edits });
    return { next: offset + edits.length };
  },
});
const kind = defineResourceKind({ id: "foobar", label: "Foobar", icon: "box" });
const view = defineView({
  id: "foobars", title: "Foobar · 5,000 resources",
  body: {
    kind: "dataTable", columns: [{ id: "title", label: "Title" }, { id: "status", label: "Status" }],
    defaultViews: [
      { id: "all", title: "All 5,000" },
      { id: "focus", title: "Last 25", filter: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "Foobar focus" }] } },
    ], defaultActiveViewId: "all", refreshEvents: [changed],
    async query(ctx) {
      const start = performance.now();
      const records = await ctx.storage.records.list();
      console.info(JSON.stringify({ demo: "foobar-query", materializedRecords: records.length, readMs: performance.now() - start }));
      return { rows: records.filter(r => !r.deleted && r.value && typeof r.value.id === "string").map(r => ({
        id: String(r.value.id), values: { title: String(r.value.title), status: String(r.value.status) },
        resource: { type: "foobar", id: String(r.value.id), label: String(r.value.title), extensionId: "demo.foobar" },
      })) };
    },
  },
});
const page = definePage({ id: "foobars", title: "Foobar", path: "foobars", icon: "box", mode: workbenchModes.project, main: { kind: "view", view: view.ref, cardinality: "one" }, slots: [] });
const nav = defineNavigationItem({ id: "foobars", label: "Foobar", icon: "box", owner: workbenchModes.project, action: { kind: "page", page: page.ref } });
export default defineExtension({ resourceKinds: [kind], commands: [seed], views: [view], pages: [page], navigationItems: [nav] });`;
export const pagedFoobar = `import { collectionTableQuery, defineCommand, defineExtension, defineNavigationItem, definePage, defineResourceKind, defineView, eventRef, params, workbenchModes } from "@pstdio/sdk/extensions";
const changed = eventRef({ extensionId: "demo.foobar", id: "changed" });
const seed = defineCommand({
  id: "seed", title: "Seed Foobar demo", cli: true, mutating: true,
  params: { offset: params.number({ required: true }) },
  async run(ctx, { offset }) {
    if (!Number.isInteger(offset) || offset < 0 || offset >= 5000) throw Error("Invalid offset");
    const edits = Array.from({ length: Math.min(10, 5000 - offset) }, (_, k) => {
      const i = offset + k;
      const id = "foobar-" + String(i + 1).padStart(4, "0");
      return { recordId: ctx.storage.records.id(id), replace: {
        id, title: (i >= 4975 ? "Foobar focus " : "Foobar background ") + String(i + 1).padStart(4, "0"),
        status: ["Todo", "In Progress", "Done"][i % 3], body: "Foobar resource content. ".repeat(350),
      } };
    });
    await ctx.storage.records.commit({ operationId: "demo-seed-ten-" + offset, edits });
    return { next: offset + edits.length };
  },
});
const kind = defineResourceKind({ id: "foobar", label: "Foobar", icon: "box" });
const view = defineView({
  id: "foobars", title: "Foobar · 5,000 resources",
  body: {
    kind: "dataTable", columns: [{ id: "title", label: "Title" }, { id: "status", label: "Status" }],
    defaultViews: [
      { id: "all", title: "All 5,000" },
      { id: "focus", title: "Last 25", filter: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "Foobar focus" }] } },
    ], defaultActiveViewId: "all", refreshEvents: [changed],
    query: collectionTableQuery({
      index: { name: "foobars", fields: { id: { path: ["id"], type: "string" }, title: { path: ["title"], type: "string" }, status: { path: ["status"], type: "string" } }, orderBy: [{ field: "id", direction: "asc" }] },
      resourceKind: "foobar",
      columns: [{ id: "title", label: "Title", type: "string" }, { id: "status", label: "Status", type: "string" }],
    }),
  },
});
const page = definePage({ id: "foobars", title: "Foobar", path: "foobars", icon: "box", mode: workbenchModes.project, main: { kind: "view", view: view.ref, cardinality: "one" }, slots: [] });
const nav = defineNavigationItem({ id: "foobars", label: "Foobar", icon: "box", owner: workbenchModes.project, action: { kind: "page", page: page.ref } });
export default defineExtension({ resourceKinds: [kind], commands: [seed], views: [view], pages: [page], navigationItems: [nav] });`;
export const plannerComparisonSeed = `import { defineCommand, params } from "@pstdio/sdk/extensions";
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
    const key = \`demo-seed-page:\${offset}\`;
    let markers = await ctx.storage.get<Marker[]>(key);
    const fresh = new Set<string>();
    if (!markers) {
      markers = [];
      const previousPage = offset ? await ctx.storage.get<Marker[]>(\`demo-seed-page:\${offset - 50}\`) : undefined;
      let previous =
        previousPage?.at(-1) ?? (offset ? await ctx.storage.get<Marker>(\`demo-seed:\${offset - 1}\`) : undefined);
      for (let i = offset; i < Math.min(offset + 50, 5000); i++) {
        const old = await ctx.storage.get<Marker>(\`demo-seed:\${i}\`);
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
            content: \`# \${title}\\n\\n\${"Demo ticket content. ".repeat(420)}\`,
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
});`;
