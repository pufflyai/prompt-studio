import { describe, expect, test } from "bun:test";
import type { ResourceRef } from "../resources/resource-registry";
import { createFavoriteRegistry, type WorkbenchFavorite } from "./favorite-registry";

const ticketsResource = {
  kind: "dashboard-view",
  uri: "pstdio://dashboard/tickets",
  label: "Tickets",
  icon: "KanbanSquare",
} satisfies ResourceRef;

const workspacesResource = {
  kind: "dashboard-view",
  uri: "pstdio://dashboard/workspaces",
  label: "Workspaces",
  icon: "GitBranch",
} satisfies ResourceRef;

describe("createFavoriteRegistry", () => {
  test("adds ordered favorites and rejects duplicate scoped targets", async () => {
    const favorites = createFavoriteRegistry();

    const first = await favorites.add({ target: ticketsResource, scope: "user" });
    const second = await favorites.add({ target: workspacesResource, scope: "user" });

    expect(first).toMatchObject({ target: ticketsResource, order: 0 });
    expect(second).toMatchObject({ target: workspacesResource, order: 1 });
    await expect(favorites.add({ target: ticketsResource, scope: "user" })).rejects.toThrow("Favorite already exists");
  });

  test("toggles favorites idempotently by scoped resource uri", async () => {
    const favorites = createFavoriteRegistry();

    await expect(favorites.isFavorited(ticketsResource, { scope: "project", projectId: "project-1" })).resolves.toBe(
      false,
    );

    const added = await favorites.toggle({
      target: ticketsResource,
      scope: "project",
      projectId: "project-1",
      label: "Project tickets",
    });

    expect(added.favorited).toBe(true);
    expect(added.favorite).toMatchObject({ label: "Project tickets", target: ticketsResource });
    await expect(favorites.isFavorited(ticketsResource, { scope: "project", projectId: "project-1" })).resolves.toBe(
      true,
    );

    const removed = await favorites.toggle({ target: ticketsResource, scope: "project", projectId: "project-1" });

    expect(removed).toEqual({ favorited: false });
    await expect(favorites.list({ scope: "project", projectId: "project-1" })).resolves.toEqual([]);
  });

  test("reorders favorites within a complete scope set", async () => {
    const favorites = createFavoriteRegistry();
    const first = await favorites.add({ target: ticketsResource, scope: "user" });
    const second = await favorites.add({ target: workspacesResource, scope: "user" });

    await favorites.reorder({ scope: "user", favoriteIds: [second.id, first.id] });

    expect((await favorites.list({ scope: "user" })).map((favorite) => favorite.id)).toEqual([second.id, first.id]);
    await expect(favorites.reorder({ scope: "user", favoriteIds: [first.id] })).rejects.toThrow(
      "Favorite reorder set is incomplete",
    );
  });

  test("requires project ids for project scoped favorites", async () => {
    const favorites = createFavoriteRegistry();

    await expect(favorites.add({ target: ticketsResource, scope: "project" })).rejects.toThrow(
      "Project scope requires projectId",
    );
  });

  test("skips favorite ids already present in persistence", async () => {
    const stored = new Map<string, WorkbenchFavorite>([
      [
        "favorite-1",
        {
          id: "favorite-1",
          target: ticketsResource,
          scope: "user" as const,
          order: 0,
          createdAt: "2026-05-18T10:00:00.000Z",
          updatedAt: "2026-05-18T10:00:00.000Z",
        },
      ],
    ]);
    const favorites = createFavoriteRegistry({
      persistence: {
        list: async () => [...stored.values()],
        add: async (input) => {
          const favorite = { ...input };
          stored.set(favorite.id, favorite);
          return favorite;
        },
        remove: async (favoriteId) => {
          stored.delete(favoriteId);
        },
        reorder: async () => undefined,
      },
    });

    const created = await favorites.add({ target: workspacesResource, scope: "user" });

    expect(created.id).toBe("favorite-2");
    expect([...stored.keys()]).toEqual(["favorite-1", "favorite-2"]);
  });
});
