interface SeedableLayout {
  hasPersistedLayout(): boolean;
  persist(): void;
}

export const seedLayoutOnce = (layout: SeedableLayout, seed: () => void) => {
  if (layout.hasPersistedLayout()) return false;
  seed();
  layout.persist();
  return true;
};
