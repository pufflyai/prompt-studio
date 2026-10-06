import { Dialog } from "@chakra-ui/react";
import type { KeyboardEvent, ReactNode, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_PALETTE_ASSET_LIMIT,
  type FilterPaletteEntriesOptions,
  filterPaletteEntries,
  getPaletteEffectiveQuery,
  type PaletteMode,
  type PaletteSearchEntry,
  resolvePaletteMode,
} from "@/components/command-palette/palette-filter";
import { PaletteList } from "@/components/command-palette/palette-list";
import { SearchModalContent } from "@/components/overlays/search-modal-content";

export type { FilterPaletteEntriesOptions, PaletteMode, PaletteSearchEntry };
export { DEFAULT_PALETTE_ASSET_LIMIT, filterPaletteEntries };

export interface PaletteEntry extends PaletteSearchEntry {
  description?: ReactNode;
  icon?: ReactNode;
  shortcut?: ReactNode;
  endContent?: ReactNode;
  group?: string;
  isSelected?: boolean;
  onActivate: () => void;
}

export interface PaletteState<T extends PaletteEntry> {
  query: string;
  mode?: string;
  activeIndex: number;
  entries: T[];
}

export interface PaletteEscapeContext<T extends PaletteEntry> extends PaletteState<T> {
  activeEntry: T | null;
  entryCount: number;
  setQuery: (query: string) => void;
  setActiveIndex: (index: SetStateAction<number>) => void;
  runActiveEntry: () => void;
  closePalette: () => void;
}

export type PaletteStateValue<T extends PaletteEntry, TValue> = TValue | ((state: PaletteState<T>) => TValue);

export interface PaletteProps<T extends PaletteEntry = PaletteEntry> {
  open: boolean;
  entries: T[];
  initialQuery?: string;
  initialActiveIndex?: number;
  mode?: string;
  modes?: PaletteMode[];
  resetKey?: string;
  inputIcon?: PaletteStateValue<T, ReactNode>;
  placeholder?: PaletteStateValue<T, string>;
  emptyLabel?: string;
  footerStart?: ReactNode;
  footerEnd?: ReactNode;
  filterEntries?: (entries: T[], query: string, mode?: string) => T[];
  onActiveEntryChange?: (entry: T | null, index: number) => void;
  onQueryChange?: (query: string) => void;
  onClose: () => void;
  onEscape?: (ctx: PaletteEscapeContext<T>) => boolean | undefined;
}

const resolveStateValue = <T extends PaletteEntry, TValue>(
  value: PaletteStateValue<T, TValue> | undefined,
  state: PaletteState<T>,
  fallback: TValue,
) => {
  if (typeof value === "function") {
    return (value as (state: PaletteState<T>) => TValue)(state);
  }

  return value ?? fallback;
};

export const Palette = <T extends PaletteEntry>(props: PaletteProps<T>) => {
  const {
    open,
    entries,
    initialQuery = "",
    initialActiveIndex = 0,
    mode,
    modes,
    resetKey = "default",
    inputIcon,
    placeholder,
    emptyLabel = "No results.",
    footerStart,
    footerEnd,
    filterEntries,
    onActiveEntryChange,
    onQueryChange,
    onClose,
    onEscape,
  } = props;
  const [query, setQueryState] = useState(initialQuery);
  const [activeIndex, setActiveIndex] = useState(initialActiveIndex);
  const [setup, setSetup] = useState({ open: false, resetKey });
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Reset while rendering, not in an effect, so the first open render already highlights
  // the initial entry and listeners never see the previous session's entry.
  if (setup.open !== open || setup.resetKey !== resetKey) {
    setSetup({ open, resetKey });
    if (open) {
      setQueryState(initialQuery);
      setActiveIndex(initialActiveIndex);
    }
  }
  const activeMode = mode ?? resolvePaletteMode(query, modes);
  const filteredEntries = filterEntries
    ? filterEntries(entries, query, activeMode)
    : filterPaletteEntries(entries, {
        query,
        mode: activeMode,
        getEffectiveQuery: (value) => getPaletteEffectiveQuery(value, modes, activeMode),
      });
  const activeEntry = filteredEntries[activeIndex] ?? null;
  const state: PaletteState<T> = { query, mode: activeMode, activeIndex, entries: filteredEntries };
  const resolvedInputIcon = resolveStateValue(inputIcon, state, null);
  const resolvedPlaceholder = resolveStateValue(placeholder, state, "Search");

  const setQuery = (nextQuery: string) => {
    setQueryState(nextQuery);
    onQueryChange?.(nextQuery);
  };

  const runActiveEntry = () => {
    activeEntry?.onActivate();
  };

  const closePalette = () => {
    onClose();
  };

  useEffect(() => {
    if (!setup.open) return;

    const timeout = setTimeout(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      const length = input.value.length;
      input.setSelectionRange(length, length);
    }, 0);
    return () => clearTimeout(timeout);
  }, [setup]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(filteredEntries.length - 1, 0)));
  }, [filteredEntries.length]);

  const activeEntryId = activeEntry?.id;
  // Callers rebuild entries and callbacks on every render. Report only a real change of the
  // highlighted entry, so a listener that updates state cannot start a render loop.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the entry and callback change identity on every render
  useEffect(() => {
    onActiveEntryChange?.(activeEntry, activeIndex);
  }, [activeEntryId, activeIndex]);

  const handleEscape = () => {
    const handled = onEscape?.({
      ...state,
      activeEntry,
      entryCount: filteredEntries.length,
      setQuery,
      setActiveIndex,
      runActiveEntry,
      closePalette,
    });
    if (handled) return;

    if (query.length > 0) {
      setQuery("");
      setActiveIndex(0);
      return;
    }

    closePalette();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, Math.max(filteredEntries.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      runActiveEntry();
      return;
    }

    if (event.key !== "Escape") return;

    event.preventDefault();
    event.stopPropagation();
    handleEscape();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(details) => !details.open && closePalette()}>
      <Dialog.Backdrop />
      <Dialog.Positioner alignItems="center" justifyContent="center" p="md">
        <Dialog.Content maxW="44rem" w="full" p="0" overflow="hidden" borderWidth="1px" borderColor="border.subtle">
          <SearchModalContent
            searchValue={query}
            searchPlaceholder={resolvedPlaceholder}
            searchIcon={resolvedInputIcon}
            searchInputRef={inputRef}
            showCloseButton
            footerStart={footerStart}
            footerEnd={footerEnd}
            scrollAreaProps={{
              maxH: "24rem",
              showHorizontalScrollbar: false,
              viewportRef: scrollRef,
              viewportProps: { style: { overflowAnchor: "none" } },
            }}
            onSearchChange={(nextQuery) => {
              setQuery(nextQuery);
              setActiveIndex(0);
            }}
            onSearchKeyDown={handleKeyDown}
          >
            <PaletteList
              entries={filteredEntries}
              activeIndex={activeIndex}
              emptyLabel={emptyLabel}
              onHover={setActiveIndex}
              scrollRef={scrollRef}
            />
          </SearchModalContent>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
