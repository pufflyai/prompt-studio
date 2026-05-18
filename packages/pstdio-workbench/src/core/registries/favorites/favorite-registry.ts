import { createDisposable, type Disposable } from "../../shared/disposable";
import type { ResourceRef } from "../resources/resource-registry";

export type WorkbenchCollectionScope = "user" | "project";

export interface FavoriteScopeInput {
  scope?: WorkbenchCollectionScope;
  projectId?: string;
}

export type FavoriteListInput = FavoriteScopeInput;

export interface AddFavoriteInput {
  target: ResourceRef;
  scope: WorkbenchCollectionScope;
  projectId?: string;
  label?: string;
  icon?: string;
  description?: string;
}

export type ToggleFavoriteInput = AddFavoriteInput;

export interface ReorderFavoritesInput {
  scope: WorkbenchCollectionScope;
  projectId?: string;
  favoriteIds: string[];
}

export interface WorkbenchFavorite extends AddFavoriteInput {
  id: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export type FavoriteChangeListener = () => void;

export interface FavoritePersistenceAdapter {
  list(input?: FavoriteListInput): Promise<WorkbenchFavorite[]>;
  add(
    input: AddFavoriteInput & { id: string; order: number; createdAt: string; updatedAt: string },
  ): Promise<WorkbenchFavorite>;
  remove(favoriteId: string): Promise<void>;
  reorder(input: ReorderFavoritesInput): Promise<void>;
}

export interface CreateFavoriteRegistryInput {
  persistence?: FavoritePersistenceAdapter;
}

export interface FavoriteRegistry {
  list(input?: FavoriteListInput): Promise<WorkbenchFavorite[]>;
  add(input: AddFavoriteInput): Promise<WorkbenchFavorite>;
  remove(favoriteId: string): Promise<void>;
  toggle(input: ToggleFavoriteInput): Promise<{ favorited: boolean; favorite?: WorkbenchFavorite }>;
  reorder(input: ReorderFavoritesInput): Promise<void>;
  isFavorited(target: ResourceRef, input?: FavoriteScopeInput): Promise<boolean>;
  refresh(): void;
  notifyExternalChange(): void;
  onDidChange(listener: FavoriteChangeListener): Disposable;
}

const matchesScope = (favorite: WorkbenchFavorite, input: FavoriteScopeInput = {}) => {
  if (input.scope && favorite.scope !== input.scope) return false;
  if (input.projectId && favorite.projectId !== input.projectId) return false;
  return true;
};

const assertProjectScope = (input: FavoriteScopeInput) => {
  if (input.scope === "project" && !input.projectId) throw new Error("Project scope requires projectId");
};

const createMemoryFavoritePersistence = () => {
  const favorites = new Map<string, WorkbenchFavorite>();

  return {
    async list(input = {}) {
      return [...favorites.values()]
        .filter((favorite) => matchesScope(favorite, input))
        .sort((left, right) => left.order - right.order || left.createdAt.localeCompare(right.createdAt));
    },

    async add(input) {
      const favorite = { ...input };
      favorites.set(favorite.id, favorite);
      return favorite;
    },

    async remove(favoriteId) {
      favorites.delete(favoriteId);
    },

    async reorder(input) {
      const orderedAt = new Date().toISOString();
      for (const [order, favoriteId] of input.favoriteIds.entries()) {
        const favorite = favorites.get(favoriteId);
        if (favorite) favorites.set(favoriteId, { ...favorite, order, updatedAt: orderedAt });
      }
    },
  } satisfies FavoritePersistenceAdapter;
};

export const createFavoriteRegistry = (input: CreateFavoriteRegistryInput = {}): FavoriteRegistry => {
  const persistence = input.persistence ?? createMemoryFavoritePersistence();
  const listeners = new Set<FavoriteChangeListener>();
  let idCounter = 0;

  const emitChange = () => {
    for (const listener of listeners) listener();
  };

  const findExisting = async (target: ResourceRef, scope: FavoriteScopeInput) =>
    (await persistence.list(scope)).find((favorite) => favorite.target.uri === target.uri);

  const nextOrder = async (scope: FavoriteScopeInput) => {
    const scoped = await persistence.list(scope);
    return scoped.reduce((max, favorite) => Math.max(max, favorite.order), -1) + 1;
  };

  const nextFavoriteId = async () => {
    let favoriteId = "";

    do {
      idCounter += 1;
      favoriteId = `favorite-${idCounter}`;
    } while ((await persistence.list()).some((favorite) => favorite.id === favoriteId));

    return favoriteId;
  };

  return {
    list(input = {}) {
      assertProjectScope(input);
      return persistence.list(input);
    },

    async add(addInput) {
      assertProjectScope(addInput);
      if (await findExisting(addInput.target, addInput)) throw new Error("Favorite already exists");

      const timestamp = new Date().toISOString();
      const favorite = await persistence.add({
        ...addInput,
        id: await nextFavoriteId(),
        order: await nextOrder(addInput),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      emitChange();
      return favorite;
    },

    async remove(favoriteId) {
      const allFavorites = await persistence.list();
      if (!allFavorites.some((favorite) => favorite.id === favoriteId)) throw new Error("Favorite not found");
      await persistence.remove(favoriteId);
      emitChange();
    },

    async toggle(toggleInput) {
      assertProjectScope(toggleInput);
      const existing = await findExisting(toggleInput.target, toggleInput);
      if (existing) {
        await persistence.remove(existing.id);
        emitChange();
        return { favorited: false };
      }

      const favorite = await this.add(toggleInput);
      return { favorited: true, favorite };
    },

    async reorder(reorderInput) {
      assertProjectScope(reorderInput);
      const current = await persistence.list(reorderInput);
      const currentIds = new Set(current.map((favorite) => favorite.id));
      if (reorderInput.favoriteIds.some((favoriteId) => !currentIds.has(favoriteId))) {
        throw new Error("Favorite not found");
      }
      if (reorderInput.favoriteIds.length !== current.length) throw new Error("Favorite reorder set is incomplete");

      await persistence.reorder(reorderInput);
      emitChange();
    },

    async isFavorited(target, input = {}) {
      assertProjectScope(input);
      return Boolean(await findExisting(target, input));
    },

    refresh: emitChange,

    notifyExternalChange: emitChange,

    onDidChange(listener) {
      listeners.add(listener);
      return createDisposable(() => {
        listeners.delete(listener);
      });
    },
  };
};
