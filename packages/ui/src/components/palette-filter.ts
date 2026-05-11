import type { ReactNode } from "react";

export const DEFAULT_PALETTE_ASSET_LIMIT = 48;

export interface PaletteSearchEntry {
  id: string;
  mode?: string;
  label: ReactNode;
  searchText?: string;
  secondaryLabel?: ReactNode;
  assetType?: string;
}

export interface PaletteMode {
  id: string;
  inputPrefix?: string;
}

export interface FilterPaletteEntriesOptions {
  query: string;
  mode?: string;
  getEffectiveQuery?: (query: string) => string;
  defaultAssetLimit?: number;
}

const getSearchableText = (entry: PaletteSearchEntry) => {
  const label = typeof entry.label === "string" ? entry.label : "";
  const secondaryLabel = typeof entry.secondaryLabel === "string" ? entry.secondaryLabel : "";

  return `${label} ${entry.searchText ?? ""} ${secondaryLabel}`;
};

const hasInputPrefix = (query: string, inputPrefix: string) => query.trimStart().startsWith(inputPrefix);

export const resolvePaletteMode = (query: string, modes: readonly PaletteMode[] = [], fallbackMode?: string) => {
  const prefixedMode = modes.find((mode) => mode.inputPrefix && hasInputPrefix(query, mode.inputPrefix));

  return prefixedMode?.id ?? fallbackMode ?? modes.find((mode) => !mode.inputPrefix)?.id ?? modes[0]?.id;
};

export const getPaletteEffectiveQuery = (query: string, modes: readonly PaletteMode[] = [], modeId?: string) => {
  const mode = modes.find(
    (candidate) => candidate.id === modeId && candidate.inputPrefix && hasInputPrefix(query, candidate.inputPrefix),
  );

  if (!mode?.inputPrefix) return query.trim();

  return query.trimStart().slice(mode.inputPrefix.length).trim();
};

const limitDefaultAssetEntries = <T extends PaletteSearchEntry>(entries: T[], limit: number) => {
  const counts: Record<string, number> = {};

  return entries.filter((entry) => {
    const assetType = entry.assetType;
    if (!assetType) return true;

    const count = counts[assetType] ?? 0;
    if (count >= limit) return false;

    counts[assetType] = count + 1;
    return true;
  });
};

export const filterPaletteEntries = <T extends PaletteSearchEntry>(
  entries: T[],
  options: FilterPaletteEntriesOptions,
) => {
  const effectiveQuery = (options.getEffectiveQuery?.(options.query) ?? options.query.trim()).toLowerCase();

  const filteredEntries = entries.filter((entry) => {
    if (options.mode && entry.mode !== options.mode) return false;
    if (!effectiveQuery) return true;

    return getSearchableText(entry).toLowerCase().includes(effectiveQuery);
  });

  if (effectiveQuery || options.defaultAssetLimit === undefined) {
    return filteredEntries;
  }

  return limitDefaultAssetEntries(filteredEntries, options.defaultAssetLimit);
};
