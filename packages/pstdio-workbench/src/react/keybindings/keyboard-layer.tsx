import { Button, Dialog, HStack, Input, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import { ListRow, PaletteShortcut, ScrollArea } from "@pstdio/ui";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { WorkbenchCore } from "../../core";
import { shortcutMenuEntries } from "../../core/controllers/keyboard/shortcut-menu";
import { runUserAction } from "../../core/shared/run-user-action";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { useKeyboardLayerKeys } from "./use-keyboard-layer-keys";
import { useShortcutCatalog } from "./use-shortcut-catalog";

const editable = (element: EventTarget | null) =>
  element instanceof HTMLElement && Boolean(element.closest('input,textarea,select,[contenteditable="true"]'));
const focusSelectedPresentation = (workbench: WorkbenchCore) => {
  const selected = workbench.keyboard.store.getState();
  const instance = selected.selectedId
    ? document.querySelector<HTMLElement>(`[data-workbench-presentation="${CSS.escape(selected.selectedId)}"]`)
    : null;
  const region = selected.selectedRegion
    ? document.querySelector<HTMLElement>(`[data-workbench-region="${selected.selectedRegion}"]`)
    : null;
  const root = instance ?? region;
  const candidates = [
    '[contenteditable="true"]',
    "textarea",
    "input",
    "iframe",
    "[autofocus]",
    '[tabindex="0"]',
    "button",
  ];
  const focus =
    candidates
      .flatMap((selector) => [...(root?.querySelectorAll<HTMLElement>(selector) ?? [])])
      .find(
        (element) =>
          element.getClientRects().length &&
          getComputedStyle(element).visibility !== "hidden" &&
          !element.matches(':disabled,[type="hidden"]'),
      ) ?? root;
  focus?.focus({ preventScroll: true });
};

export const WorkbenchKeyboardLayer = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const { state, catalog: all } = useShortcutCatalog(workbench);
  useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  useWorkbenchStore(workbench.keybindings.store, (state) => state.keybindings);
  const styles = useSlotRecipe({ key: "palette" })();
  const heading = useRef<HTMLHeadingElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const queryInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState(false);
  useKeyboardLayerKeys({
    workbench,
    content,
    heading,
    search: () => {
      setSearch(true);
      queueMicrotask(() => queryInput.current?.focus());
    },
  });
  const wasActive = useRef(false);
  const selection = state.selection;
  const run = (action: () => unknown) => void runUserAction(workbench, "Keyboard shortcut", action);
  // biome-ignore lint/correctness/useExhaustiveDependencies: each prefix or selector starts with neutral heading focus.
  useEffect(() => {
    setQuery("");
    setSearch(false);
    if (state.active) queueMicrotask(() => heading.current?.focus());
  }, [state.path, selection, state.active]);
  useLayoutEffect(() => {
    if (wasActive.current && !state.active && state.restoreFocus) focusSelectedPresentation(workbench);
    wasActive.current = state.active;
  }, [state.active, state.restoreFocus, workbench]);
  useEffect(() => {
    const activation = workbench.layout.onDidActivatePanel((panel) => {
      if (
        !workbench.keyboard.store.getState().active ||
        workbench.keyboard.store.getState().selection ||
        workbench.keyboard.store.getState().selectedId === panel.instanceId
      )
        return;
      workbench.keyboard.selectPresentation(panel.instanceId);
      heading.current?.focus();
    });
    return () => activation.dispose();
  }, [workbench]);
  useEffect(() => {
    if (!state.active) return;
    const pointer = (event: PointerEvent) => {
      if (content.current?.contains(event.target as Node)) return;
      if (editable(event.target)) workbench.keyboard.close(false);
    };
    const focus = (event: FocusEvent) => {
      if (!workbench.keyboard.store.getState().active || content.current?.contains(event.target as Node)) return;
      if ((event.target as HTMLElement).closest('[role="dialog"],[role="menu"]')) return;
      heading.current?.focus();
    };
    const blur = () => workbench.keyboard.close(false);
    window.addEventListener("blur", blur);
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("focusin", focus);
    return () => {
      window.removeEventListener("blur", blur);
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("focusin", focus);
    };
  }, [state.active, workbench]);
  const entries = selection?.choices ?? shortcutMenuEntries(all, state.path);
  const searched =
    search && !selection
      ? all
          .filter((shortcut) =>
            `${shortcut.label} ${shortcut.binding.sourceExtensionId ?? ""} ${shortcut.keys.join(" ")}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((shortcut) => ({ key: shortcut.id, label: shortcut.label, disabled: shortcut.disabled }))
      : entries.filter((entry) => entry.label.toLowerCase().includes(query.toLowerCase()));
  const title = selection?.title ?? `Keyboard menu${state.path.length ? ` / ${state.path.join(" / ")}` : ""}`;
  const activate = (key: string) =>
    run(() => {
      if (search && !selection) return workbench.keyboard.invoke(key);
      if (selection) return workbench.keyboard.choose(key);
      return workbench.keyboard.press(key);
    });
  return (
    <Dialog.Root
      open={state.active}
      modal={Boolean(selection)}
      trapFocus={Boolean(selection)}
      restoreFocus={false}
      preventScroll={false}
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
      {selection ? <Dialog.Backdrop /> : null}
      <Dialog.Positioner css={styles.positioner} pointerEvents={selection ? "auto" : "none"}>
        <Dialog.Content
          ref={content}
          css={styles.content}
          pointerEvents="auto"
          aria-label={title}
          aria-modal={Boolean(selection)}
        >
          <Dialog.Header>
            <Dialog.Title
              ref={(element) => {
                heading.current = element;
                if (element)
                  queueMicrotask(() => {
                    if (workbench.keyboard.store.getState().active) element.focus({ preventScroll: true });
                  });
              }}
              tabIndex={-1}
            >
              {title}
            </Dialog.Title>
          </Dialog.Header>
          {selection || search ? (
            <Input
              ref={queryInput}
              value={query}
              aria-label="Search keyboard choices"
              placeholder="Search by action, resource, or panel"
              variant="borderless"
              size="sm"
              onChange={(event) => setQuery(event.target.value)}
            />
          ) : null}
          <Dialog.Body p="0">
            <ScrollArea maxH="palette-results-height" showHorizontalScrollbar={false}>
              {searched.map((entry) => (
                <ListRow
                  key={entry.key}
                  role="button"
                  tabIndex={0}
                  data-keyboard-choice={entry.key}
                  variant="full-width"
                  label={entry.label}
                  disabled={"disabled" in entry && entry.disabled}
                  endContent={
                    (search && !selection) ||
                    (state.path.length === 1 && state.path[0] === "E" && entry.key.length > 1) ? undefined : (
                      <PaletteShortcut binding={entry.key} />
                    )
                  }
                  onActivate={() => activate(entry.key)}
                />
              ))}
              {!searched.length ? (
                <Text px="sm" py="sm" color="fg.muted">
                  No applicable shortcuts. Press / to search all actions.
                </Text>
              ) : null}
            </ScrollArea>
          </Dialog.Body>
          <Dialog.Footer>
            <Stack gap="2xs" flex="1">
              <Text textStyle="label/XS/regular" color="fg.muted">
                {selection
                  ? "Choose a target · nothing is selected initially"
                  : "← / → circulate · navigation stays active · Enter/Escape finishes"}
              </Text>
              {state.message ? (
                <Text role="status" textStyle="label/XS/regular">
                  {state.message}
                </Text>
              ) : null}
            </Stack>
            <HStack>
              <Button size="xs" variant="ghost" onClick={() => workbench.keyboard.back()}>
                Back
              </Button>
              <Button size="xs" variant="ghost" onClick={() => workbench.keyboard.finish()}>
                {selection ? "Cancel" : "Exit"}
              </Button>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
