import { CloseButton, Dialog, Input, InputGroup, Menu } from "@chakra-ui/react";
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
} from "./palette-filter";
import { PaletteList } from "./palette-list";
import { ScrollArea } from "./scroll-area";

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
    onClose,
    onEscape,
  } = props;
  const [query, setQueryState] = useState(initialQuery);
  const [activeIndex, setActiveIndex] = useState(initialActiveIndex);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const setupRef = useRef({ open: false, resetKey });
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
  };

  const runActiveEntry = () => {
    activeEntry?.onActivate();
  };

  const closePalette = () => {
    onClose();
  };

  useEffect(() => {
    const previousSetup = setupRef.current;
    setupRef.current = { open, resetKey };
    if (!open) return;

    const shouldInitialize = !previousSetup.open || previousSetup.resetKey !== resetKey;
    if (!shouldInitialize) return;

    setQueryState(initialQuery);
    setActiveIndex(initialActiveIndex);

    const timeout = setTimeout(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      const length = input.value.length;
      input.setSelectionRange(length, length);
    }, 0);
    return () => clearTimeout(timeout);
  }, [initialActiveIndex, initialQuery, open, resetKey]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(filteredEntries.length - 1, 0)));
  }, [filteredEntries.length]);

  useEffect(() => {
    onActiveEntryChange?.(activeEntry, activeIndex);
  }, [activeEntry, activeIndex, onActiveEntryChange]);

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

  const hasFooter = footerStart || footerEnd;

  return (
    <Dialog.Root open={open} onOpenChange={(details) => !details.open && closePalette()}>
      <Dialog.Backdrop />
      <Dialog.Positioner alignItems="flex-start" pt="10vh">
        <Dialog.Content maxW="44rem" p="0" overflow="hidden">
          <Dialog.Header px="0" py="0" borderBottomWidth="1px" borderBottomColor="border.muted">
            <InputGroup startElement={resolvedInputIcon}>
              <Input
                ref={inputRef}
                value={query}
                placeholder={resolvedPlaceholder}
                aria-label={resolvedPlaceholder}
                autoComplete="off"
                borderWidth="0"
                borderRadius="0"
                h="3rem"
                _focus={{ boxShadow: "none" }}
                _focusVisible={{ boxShadow: "none" }}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleKeyDown}
              />
            </InputGroup>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" mr="2" />
            </Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body p="0">
            <ScrollArea
              maxH="24rem"
              showHorizontalScrollbar={false}
              viewportRef={scrollRef}
              viewportProps={{ style: { overflowAnchor: "none" } }}
            >
              <Menu.Root open closeOnSelect={false}>
                <Menu.Content
                  borderRadius={0}
                  position="static"
                  minW="full"
                  bg="transparent"
                  boxShadow="none"
                  borderWidth="0"
                >
                  <PaletteList
                    entries={filteredEntries}
                    activeIndex={activeIndex}
                    emptyLabel={emptyLabel}
                    onHover={setActiveIndex}
                    scrollRef={scrollRef}
                  />
                </Menu.Content>
              </Menu.Root>
            </ScrollArea>
          </Dialog.Body>
          {hasFooter ? (
            <Dialog.Footer
              justifyContent="space-between"
              px="sm"
              py="xs"
              borderTopWidth="1px"
              borderTopColor="border.muted"
            >
              {footerStart}
              {footerEnd}
            </Dialog.Footer>
          ) : null}
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
