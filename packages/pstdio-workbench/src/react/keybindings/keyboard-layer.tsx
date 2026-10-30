import { Box, Dialog, Input, Portal, Text, useSlotRecipe } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { WorkbenchCore } from "../../core";
import { shortcutMenuEntries, shortcutPathLabels } from "../../core/controllers/keyboard/shortcut-menu";
import { runUserAction } from "../../core/shared/run-user-action";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { KeyboardChoices } from "./keyboard-choices";
import { KeyboardSequence } from "./keyboard-sequence";
import { focusKeyboardChoice, useKeyboardLayerKeys } from "./use-keyboard-layer-keys";
import { useKeyboardModeFocus } from "./use-keyboard-mode-focus";
import { useShortcutCatalog } from "./use-shortcut-catalog";

export const WorkbenchKeyboardLayer = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const state = useWorkbenchStore(workbench.keyboard.store, (state) => state);
  const { catalog } = useShortcutCatalog(workbench, state.active);
  useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const bubble = useSlotRecipe({ key: "keyboardBubble" })();
  const palette = useSlotRecipe({ key: "palette" })();
  const content = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLElement>(null);
  const queryInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [browseDirection, setBrowseDirection] = useState<string>();
  const selection = state.selection;
  const expanded = hovered || search || Boolean(browseDirection);
  useKeyboardModeFocus(workbench, state, content, heading);
  useKeyboardLayerKeys({
    workbench,
    content,
    heading,
    search: () => setSearch(true),
    browse: (direction, choicesVisible) => setBrowseDirection(choicesVisible ? "active" : direction),
  });
  useEffect(() => {
    if (!state.active) setHovered(false);
  }, [state.active]);
  // Each prefix and selector starts with neutral focus; completed navigation keeps its prefix.
  // biome-ignore lint/correctness/useExhaustiveDependencies: lastKey and availability changes must not reset browsing or search.
  useEffect(() => {
    setQuery("");
    setSearch(false);
    setBrowseDirection(undefined);
    if (state.active) queueMicrotask(() => heading.current?.focus({ preventScroll: true }));
  }, [state.path, selection, state.active]);
  useLayoutEffect(() => {
    if (search) queryInput.current?.focus();
  }, [search]);
  useLayoutEffect(() => {
    if (browseDirection && browseDirection !== "active") focusKeyboardChoice(content.current, browseDirection);
  }, [browseDirection]);
  const entries = selection?.choices ?? shortcutMenuEntries(catalog, state.path);
  const filtered =
    search && !selection
      ? catalog
          .filter((shortcut) =>
            `${shortcut.label} ${shortcut.binding.sourceExtensionLabel ?? ""} ${shortcut.keys.join(" ")}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((shortcut) => ({ key: shortcut.id, label: shortcut.label, disabled: shortcut.disabled }))
      : entries.filter((entry) => entry.label.toLowerCase().includes(query.toLowerCase()));
  const activate = (key: string) =>
    void runUserAction(workbench, "Keyboard shortcut", () => {
      if (selection) return workbench.keyboard.choose(key);
      return search ? workbench.keyboard.invoke(key) : workbench.keyboard.press(key);
    });
  const title = shortcutPathLabels(catalog, state.path).at(-1);
  const input =
    selection || search ? (
      <Input
        ref={queryInput}
        value={query}
        aria-label="Search keyboard choices"
        placeholder="Search by action, resource, or panel"
        variant="borderless"
        size="sm"
        onChange={(event) => setQuery(event.target.value)}
      />
    ) : null;
  const choices = <KeyboardChoices entries={filtered} search={search && !selection} onActivate={activate} />;
  if (selection)
    return (
      <Dialog.Root
        open={state.active}
        restoreFocus={false}
        initialFocusEl={() => heading.current}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          workbench.keyboard.finish();
        }}
        onOpenChange={(details) => {
          if (!details.open) workbench.keyboard.finish();
        }}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner css={palette.positioner}>
          <Dialog.Content ref={content} css={palette.content} aria-label={selection.title}>
            <Dialog.Header>
              <Dialog.Title
                ref={(node) => {
                  heading.current = node;
                }}
                tabIndex={-1}
              >
                {selection.title}
              </Dialog.Title>
            </Dialog.Header>
            {input}
            <Dialog.Body p="0">
              <ScrollArea maxH="palette-results-height" showHorizontalScrollbar={false}>
                {choices}
              </ScrollArea>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    );
  if (!state.active) return null;
  return (
    <Portal>
      <Box
        ref={content}
        css={bubble.root}
        data-expanded={expanded}
        role="region"
        aria-label="Keyboard shortcut mode"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {expanded ? (
          <Box css={bubble.choices}>
            {title ? <Text css={bubble.title}>{title}</Text> : null}
            {input}
            <ScrollArea maxH="keyboard-bubble-results" showHorizontalScrollbar={false}>
              {choices}
              {!filtered.length ? <Text css={bubble.status}>No applicable shortcuts.</Text> : null}
            </ScrollArea>
          </Box>
        ) : null}
        <Box
          ref={(node: HTMLDivElement | null) => {
            heading.current = node;
          }}
          tabIndex={-1}
          css={bubble.sequence}
          role="status"
          aria-label="Pressed shortcut sequence"
          aria-live="polite"
          aria-atomic="true"
        >
          <KeyboardSequence state={state} catalog={catalog} />
        </Box>
        {state.message ? (
          <Text role="status" css={bubble.status}>
            {state.message}
          </Text>
        ) : null}
      </Box>
    </Portal>
  );
};
