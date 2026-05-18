import { describe, expect, test } from "bun:test";
import {
  createSavedViewRegistry,
  type SavedViewKindContribution,
  type WorkbenchSavedView,
} from "./saved-view-registry";

const ticketKind = {
  kind: "ticket",
  label: "Ticket view",
  icon: "Ticket",
  fields: [
    {
      id: "status",
      label: "Status",
      type: "enum",
      operators: ["is", "isNot", "in", "notIn"],
      options: [{ value: "review", label: "Review" }],
    },
    { id: "assignee", label: "Assignee", type: "user", operators: ["is", "in", "isEmpty", "isNotEmpty"] },
  ],
  layouts: ["table", "board"],
  defaultDisplay: { layout: "table", columns: ["status"] },
  resolveQuery: async ({ view }) => ({ rows: [view.id] }),
  createResource: (view) => ({
    kind: "savedView",
    uri: `pstdio://views/${view.id}`,
    id: view.id,
    label: view.name,
    icon: "Table",
    metadata: { resourceKind: view.resourceKind },
  }),
} satisfies SavedViewKindContribution;

describe("createSavedViewRegistry", () => {
  test("registers kinds and creates scoped saved views", async () => {
    const savedViews = createSavedViewRegistry();
    savedViews.registerKind(ticketKind);

    const view = await savedViews.create({
      name: "Review tickets",
      resourceKind: "ticket",
      filter: { field: "status", operator: "is", value: "review" },
      display: { layout: "table", columns: ["status"], sort: [{ field: "status", direction: "asc" }] },
      scope: "project",
      projectId: "project-1",
    });

    expect(view).toMatchObject({
      name: "Review tickets",
      resourceKind: "ticket",
      schemaVersion: 1,
      scope: "project",
      projectId: "project-1",
    });
    expect((await savedViews.list({ scope: "project", projectId: "project-1" })).map((item) => item.id)).toEqual([
      view.id,
    ]);
    expect(savedViews.getKind("ticket")?.createResource(view).uri).toBe(`pstdio://views/${view.id}`);
  });

  test("validates filter fields, operators, display fields, and project scope", async () => {
    const savedViews = createSavedViewRegistry();
    savedViews.registerKind(ticketKind);

    await expect(
      savedViews.create({
        name: "Missing field",
        resourceKind: "ticket",
        filter: { field: "missing", operator: "is", value: "review" },
        display: { layout: "table" },
        scope: "user",
      }),
    ).rejects.toThrow("Saved view filter is invalid");

    await expect(
      savedViews.create({
        name: "Bad display",
        resourceKind: "ticket",
        filter: { field: "status", operator: "is", value: "review" },
        display: { layout: "table", sort: [{ field: "missing", direction: "asc" }] },
        scope: "user",
      }),
    ).rejects.toThrow("Saved view display is invalid");

    await expect(
      savedViews.create({
        name: "Project view",
        resourceKind: "ticket",
        filter: { field: "status", operator: "is", value: "review" },
        display: { layout: "table" },
        scope: "project",
      }),
    ).rejects.toThrow("Project scope requires projectId");
  });

  test("updates, duplicates, and deletes saved views", async () => {
    const savedViews = createSavedViewRegistry();
    savedViews.registerKind(ticketKind);
    const view = await savedViews.create({
      name: "Review tickets",
      resourceKind: "ticket",
      filter: { field: "status", operator: "is", value: "review" },
      display: { layout: "table" },
      scope: "user",
    });

    const updated = await savedViews.update(view.id, { name: "Needs review", display: { layout: "board" } });
    const duplicate = await savedViews.duplicate(view.id, { name: "Review copy" });
    await savedViews.delete(view.id);

    expect(updated).toMatchObject({ id: view.id, name: "Needs review", display: { layout: "board" } });
    expect(duplicate).toMatchObject({ name: "Review copy", resourceKind: "ticket", scope: "user" });
    expect(duplicate.id).not.toBe(view.id);
    await expect(savedViews.get(view.id)).resolves.toBeUndefined();
  });

  test("skips saved view ids already present in persistence", async () => {
    const stored = new Map<string, WorkbenchSavedView>([
      [
        "saved-view-1",
        {
          id: "saved-view-1",
          name: "Existing review tickets",
          resourceKind: "ticket",
          filter: { field: "status", operator: "is", value: "review" },
          display: { layout: "table" },
          scope: "user" as const,
          order: 0,
          schemaVersion: 1,
          createdAt: "2026-05-18T10:00:00.000Z",
          updatedAt: "2026-05-18T10:00:00.000Z",
        },
      ],
    ]);
    const savedViews = createSavedViewRegistry({
      persistence: {
        list: async () => [...stored.values()],
        get: async (id) => stored.get(id),
        create: async (input) => {
          const view = { ...input };
          stored.set(view.id, view);
          return view;
        },
        update: async (id, patch) => {
          const existing = stored.get(id);
          if (!existing) throw new Error(`Saved view not found: ${id}`);
          const view = { ...existing, ...patch };
          stored.set(id, view);
          return view;
        },
        delete: async (id) => {
          stored.delete(id);
        },
      },
    });
    savedViews.registerKind(ticketKind);

    const created = await savedViews.create({
      name: "Review tickets",
      resourceKind: "ticket",
      filter: { field: "status", operator: "is", value: "review" },
      display: { layout: "table" },
      scope: "user",
    });

    expect(created.id).toBe("saved-view-2");
    expect([...stored.keys()]).toEqual(["saved-view-1", "saved-view-2"]);
  });

  test("surfaces lazy migration failures as invalid saved views", async () => {
    const savedViews = createSavedViewRegistry({
      persistence: {
        list: async () => [
          {
            id: "view-1",
            name: "Old view",
            resourceKind: "ticket",
            filter: { field: "status", operator: "is", value: "review" },
            display: { layout: "table" },
            scope: "user",
            order: 0,
            schemaVersion: 1,
            createdAt: "2026-05-18T10:00:00.000Z",
            updatedAt: "2026-05-18T10:00:00.000Z",
          },
        ],
        get: async (id) =>
          id === "view-1"
            ? {
                id: "view-1",
                name: "Old view",
                resourceKind: "ticket",
                filter: { field: "status", operator: "is", value: "review" },
                display: { layout: "table" },
                scope: "user",
                order: 0,
                schemaVersion: 1,
                createdAt: "2026-05-18T10:00:00.000Z",
                updatedAt: "2026-05-18T10:00:00.000Z",
              }
            : undefined,
        create: async (input) => input,
        update: async (_id, patch) => ({
          id: "view-1",
          name: "Old view",
          resourceKind: "ticket",
          filter: { field: "status", operator: "is", value: "review" },
          display: { layout: "table" },
          scope: "user",
          order: 0,
          schemaVersion: 1,
          createdAt: "2026-05-18T10:00:00.000Z",
          ...patch,
        }),
        delete: async () => undefined,
      },
    });
    savedViews.registerKind({
      ...ticketKind,
      currentSchemaVersion: 2,
      migrate: () => {
        throw new Error("broken migration");
      },
    });

    await expect(savedViews.list()).resolves.toMatchObject([{ id: "view-1", invalid: "migration" }]);
    await expect(savedViews.get("view-1")).resolves.toMatchObject({ id: "view-1", invalid: "migration" });
  });
});
