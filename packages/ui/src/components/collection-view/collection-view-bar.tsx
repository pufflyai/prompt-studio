import { Box, Button, HStack, Icon, IconButton, Stack, Text } from "@chakra-ui/react";
import { ArrowUpDown, ListFilter, Plus, RotateCcw } from "lucide-react";
import { type ReactNode, type RefObject, useRef, useState } from "react";
import { Tooltip } from "@/components/primitives/tooltip";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { canSortField, findField } from "./collection-view-fields";
import { countFilterRules, isFilterGroup } from "./collection-view-filter";
import { FilterRulePill, GroupPill, SortPill } from "./collection-view-pills";
import { removeGroupAt, setRuleAt } from "./collection-view-rules";
import { CollectionViewTabs } from "./collection-view-tabs";
import type { CollectionSavedView, CollectionViewsSource } from "./collection-view-types";
import { FilterMenu } from "./filter-menu";
import type { RuleValueOption } from "./filter-rule-value";
import {
  type CollectionViewMenu,
  type CollectionViewStoreInitialState,
  type CollectionViewStoreState,
  useCollectionViewStore,
} from "./use-collection-view-store";
import { isCollectionViewDirty } from "./use-collection-views";
import { ViewBarPopover } from "./view-bar-popover";
import { ViewFilterMenu } from "./view-filter-menu";
import { ViewSearchField } from "./view-search-field";
import { ViewSortMenu } from "./view-sort-menu";

export interface CollectionViewBarProps<TSettings> {
  storageKey: string;
  initialState: CollectionViewStoreInitialState<TSettings>;
  views: (CollectionSavedView<TSettings> & { builtIn: boolean })[];
  defaultViewId?: string;
  viewsSource?: CollectionViewsSource<TSettings>;
  /** Every field of the view. Filter offers the filterable ones and Sort the sortable ones. */
  fields: AttributeDescriptor[];
  optionsFor: (field: AttributeDescriptor) => RuleValueOption[];
  /** Search is screen state owned by the renderer. It is never saved. */
  search: string;
  onSearchChange: (value: string) => void;
  searchResultLabel?: string;
  leading?: ReactNode;
  actions?: ReactNode;
  displayControl: ReactNode;
  align?: "split" | "end";
}

interface CountButtonProps {
  label: string;
  icon: typeof ListFilter;
  count: number;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onClick: () => void;
}

/** An icon button while the view has no rules, then a button that shows the rule count. */
const CountButton = (props: CountButtonProps) => {
  const { label, icon, count, buttonRef, onClick } = props;
  return (
    <Tooltip content={label}>
      {count > 0 ? (
        <Button ref={buttonRef} aria-label={label} variant="subtle" size="2xs" onClick={onClick}>
          <Icon as={icon} />
          {count}
        </Button>
      ) : (
        <IconButton ref={buttonRef} aria-label={label} variant="ghost" size="2xs" onClick={onClick}>
          <Icon as={icon} />
        </IconButton>
      )}
    </Tooltip>
  );
};

/** One view bar for data tables and both kanban displays: saved views, then Search, Filter, Sort, and Display. */
export const CollectionViewBar = <TSettings,>(props: CollectionViewBarProps<TSettings>) => {
  const { storageKey, initialState, views, defaultViewId, viewsSource, fields, optionsFor } = props;
  const { search, onSearchChange, searchResultLabel, leading, actions, displayControl, align = "split" } = props;
  const store: CollectionViewStoreState<TSettings> = useCollectionViewStore(storageKey, initialState, (state) => state);
  const { activeViewId, settings, filter, sorts, openMenu, openRuleIndex } = store;
  const { activateView, setFilter, setSorts, setOpenMenu, setOpenRuleIndex, startRule } = store;
  const activeView = views.find((view) => view.id === activeViewId);
  const state = { settings, filter, sorts };
  const dirty = isCollectionViewDirty(activeView, state);
  const filterFields = fields.filter((field) => field.filterable);
  const sortFields = fields.filter(canSortField);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const addFilterRef = useRef<HTMLButtonElement>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const sortPillRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<RefObject<HTMLButtonElement | null>>(filterButtonRef);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const open = (next: CollectionViewMenu, from: RefObject<HTMLButtonElement | null>) => {
    setAnchor(from);
    setOpenMenu(openMenu === next && anchor === from ? null : next);
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };
  const createView = async (input: Parameters<CollectionViewsSource<TSettings>["onCreateView"]>[0]) => {
    if (viewsSource) activateView(await viewsSource.onCreateView(input));
  };
  const optionsForId = (id: string) => {
    const field = findField(filterFields, id);
    return field ? optionsFor(field) : [];
  };
  const showCriteria = dirty || filter.rules.length > 0 || sorts.length > 0;

  return (
    <Stack data-testid="collection-view-bar" gap="0" flexShrink={0} borderBottomWidth="1px" borderColor="border.subtle">
      <HStack height="view-bar" minW="0" gap="2xs" paddingX="xs">
        {leading}
        <CollectionViewTabs
          views={views}
          activeViewId={activeViewId}
          defaultViewId={defaultViewId}
          viewsSource={viewsSource}
          dirty={dirty}
          busy={busy}
          state={state}
          onActivate={activateView}
          run={run}
          createView={createView}
        />
        {align === "split" ? <Box flex="1" /> : null}
        <ViewSearchField value={search} onValueChange={onSearchChange} resultLabel={searchResultLabel} />
        <CountButton
          label="Filter"
          icon={ListFilter}
          count={countFilterRules(filter)}
          buttonRef={filterButtonRef}
          onClick={() => open("picker", filterButtonRef)}
        />
        <CountButton
          label="Sort"
          icon={ArrowUpDown}
          count={sorts.length}
          buttonRef={sortButtonRef}
          onClick={() => open("sort", sortButtonRef)}
        />
        {displayControl}
        {actions}
      </HStack>

      {showCriteria ? (
        <HStack
          data-testid="collection-view-criteria"
          height="view-subheader"
          minW="0"
          gap="2xs"
          paddingX="xs"
          borderTopWidth="1px"
          borderColor="border.subtle"
        >
          <HStack minW="0" gap="2xs" overflowX="auto">
            <SortPill
              fields={sortFields}
              sorts={sorts}
              buttonRef={sortPillRef}
              onOpen={() => open("sort", sortPillRef)}
            />
            {sorts.length > 0 && filter.rules.length > 0 ? (
              <Box width="1px" height="1rem" flexShrink={0} bg="border" />
            ) : null}
            {filter.conjunction === "or" && filter.rules.length > 0 ? (
              <GroupPill
                group={filter}
                onOpen={() => open("advanced", filterButtonRef)}
                onRemove={() => setFilter({ conjunction: "and", rules: [] })}
              />
            ) : (
              filter.rules.map((rule, index) =>
                isFilterGroup(rule) ? (
                  <GroupPill
                    key={`group:${index}`}
                    group={rule}
                    onOpen={() => open("advanced", filterButtonRef)}
                    onRemove={() => setFilter(removeGroupAt(filter, index))}
                  />
                ) : (
                  <FilterRulePill
                    key={`${index}:${rule.attributeId}`}
                    fields={filterFields}
                    rule={rule}
                    options={optionsForId(rule.attributeId)}
                    open={openRuleIndex === index}
                    onOpenChange={(isOpen) => setOpenRuleIndex(isOpen ? index : null)}
                    onChange={(next) => setFilter(setRuleAt(filter, [index], next))}
                    onRemove={() => setFilter(setRuleAt(filter, [index], undefined))}
                    onOpenAdvanced={() => open("advanced", filterButtonRef)}
                  />
                ),
              )
            )}
            <Button
              ref={addFilterRef}
              aria-label="Add filter"
              size="2xs"
              variant="ghost"
              flexShrink={0}
              onClick={() => open("picker", addFilterRef)}
            >
              <Plus />
              Filter
            </Button>
          </HStack>
          <Box flex="1" />
          {dirty ? (
            <>
              <Button size="2xs" variant="outline" onClick={() => activeView && activateView(activeView)}>
                <RotateCcw />
                Reset
              </Button>
              <Button
                size="2xs"
                variant="primary"
                disabled={!viewsSource || busy}
                onClick={() =>
                  viewsSource &&
                  activeView &&
                  run(() =>
                    activeView.builtIn
                      ? createView({ title: `${activeView.title} copy`, ...state })
                      : viewsSource.onUpdateView(activeView.id, state),
                  )
                }
              >
                {activeView?.builtIn ? "Save as new view" : "Save view"}
              </Button>
            </>
          ) : null}
        </HStack>
      ) : null}

      {error ? (
        <Text role="alert" color="fg.error" textStyle="label/S" padding="xs">
          {error}
        </Text>
      ) : null}

      <ViewBarPopover
        open={openMenu === "picker"}
        onOpenChange={(isOpen) => setOpenMenu(isOpen ? "picker" : null)}
        anchorRef={anchor}
        width="min(440px, calc(100vw - 32px))"
        padding="0"
        testId="filter-menu-popover"
      >
        <FilterMenu
          fields={filterFields}
          filter={filter}
          optionsFor={optionsFor}
          onChange={setFilter}
          onPickField={startRule}
          onOpenAdvanced={() => setOpenMenu("advanced")}
        />
      </ViewBarPopover>
      <ViewBarPopover
        open={openMenu === "advanced"}
        onOpenChange={(isOpen) => setOpenMenu(isOpen ? "advanced" : null)}
        anchorRef={anchor}
        width="40rem"
        testId="view-filter-popover"
      >
        <ViewFilterMenu fields={filterFields} filter={filter} optionsFor={optionsFor} onChange={setFilter} />
      </ViewBarPopover>
      <ViewBarPopover
        open={openMenu === "sort"}
        onOpenChange={(isOpen) => setOpenMenu(isOpen ? "sort" : null)}
        anchorRef={anchor}
        width="25rem"
        testId="view-sort-popover"
      >
        <ViewSortMenu fields={sortFields} sorts={sorts} onChange={setSorts} />
      </ViewBarPopover>
    </Stack>
  );
};
