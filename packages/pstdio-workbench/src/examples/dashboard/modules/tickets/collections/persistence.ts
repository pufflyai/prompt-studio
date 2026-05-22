import type {
  FavoriteListInput,
  FavoritePersistenceAdapter,
  SavedViewListInput,
  SavedViewPersistenceAdapter,
  WorkbenchFavorite,
  WorkbenchSavedView,
} from "../../../../../core";

const favoriteStorageKey = "pstdio-workbench.dashboard.favorites";
const savedViewStorageKey = "pstdio-workbench.dashboard.savedViews";
const memoryStorage = new Map<string, string>();

const getItem = (key: string) => globalThis.localStorage?.getItem(key) ?? memoryStorage.get(key) ?? null;

const setItem = (key: string, value: string) => {
  if (globalThis.localStorage) {
    globalThis.localStorage.setItem(key, value);
    return;
  }

  memoryStorage.set(key, value);
};

const readCollection = <TItem>(key: string) => JSON.parse(getItem(key) ?? "[]") as TItem[];

const writeCollection = <TItem>(key: string, items: readonly TItem[]) => {
  setItem(key, JSON.stringify(items));
};

const matchesFavoriteScope = (favorite: WorkbenchFavorite, input: FavoriteListInput = {}) => {
  if (input.scope && favorite.scope !== input.scope) return false;
  if (input.projectId && favorite.projectId !== input.projectId) return false;
  return true;
};

const matchesSavedViewListInput = (view: WorkbenchSavedView, input: SavedViewListInput = {}) => {
  if (input.scope && view.scope !== input.scope) return false;
  if (input.projectId && view.projectId !== input.projectId) return false;
  if (input.resourceKind && view.resourceKind !== input.resourceKind) return false;
  return true;
};

const createDashboardFavoritePersistence = () =>
  ({
    async list(input = {}) {
      return readCollection<WorkbenchFavorite>(favoriteStorageKey)
        .filter((favorite) => matchesFavoriteScope(favorite, input))
        .sort((left, right) => left.order - right.order || left.createdAt.localeCompare(right.createdAt));
    },

    async add(input) {
      const favorite = { ...input };
      const favorites = readCollection<WorkbenchFavorite>(favoriteStorageKey);
      writeCollection(favoriteStorageKey, [...favorites, favorite]);
      return favorite;
    },

    async remove(favoriteId) {
      writeCollection(
        favoriteStorageKey,
        readCollection<WorkbenchFavorite>(favoriteStorageKey).filter((favorite) => favorite.id !== favoriteId),
      );
    },

    async reorder(input) {
      const orderedAt = new Date().toISOString();
      const orders = new Map(input.favoriteIds.map((favoriteId, order) => [favoriteId, order]));
      const favorites = readCollection<WorkbenchFavorite>(favoriteStorageKey).map((favorite) => {
        const order = orders.get(favorite.id);
        return order === undefined ? favorite : { ...favorite, order, updatedAt: orderedAt };
      });
      writeCollection(favoriteStorageKey, favorites);
    },
  }) satisfies FavoritePersistenceAdapter;

const createDashboardSavedViewPersistence = () =>
  ({
    async list(input = {}) {
      return readCollection<WorkbenchSavedView>(savedViewStorageKey)
        .filter((view) => matchesSavedViewListInput(view, input))
        .sort((left, right) => (left.order ?? 0) - (right.order ?? 0) || left.createdAt.localeCompare(right.createdAt));
    },

    async get(id) {
      return readCollection<WorkbenchSavedView>(savedViewStorageKey).find((view) => view.id === id);
    },

    async create(input) {
      const view = { ...input };
      const views = readCollection<WorkbenchSavedView>(savedViewStorageKey);
      writeCollection(savedViewStorageKey, [...views, view]);
      return view;
    },

    async update(id, patch) {
      let updated: WorkbenchSavedView | undefined;
      const views = readCollection<WorkbenchSavedView>(savedViewStorageKey).map((view) => {
        if (view.id !== id) return view;
        updated = { ...view, ...patch };
        return updated;
      });
      if (!updated) throw new Error(`Saved view not found: ${id}`);
      writeCollection(savedViewStorageKey, views);
      return updated;
    },

    async delete(id) {
      writeCollection(
        savedViewStorageKey,
        readCollection<WorkbenchSavedView>(savedViewStorageKey).filter((view) => view.id !== id),
      );
    },
  }) satisfies SavedViewPersistenceAdapter;

export const createDashboardCollectionPersistence = () => ({
  favoritePersistence: createDashboardFavoritePersistence(),
  savedViewPersistence: createDashboardSavedViewPersistence(),
});
