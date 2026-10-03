import { Box, Button, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { ListFilter, Plus, RotateCcw } from "lucide-react";
import { type ReactNode, type RefObject, useRef, useState } from "react";
import { Tooltip } from "@/components/primitives/tooltip";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { addAdvancedGroup, normalFilter, setAdvancedGroup } from "./advanced-filter";
import { AdvancedFilterPill } from "./advanced-filter-pill";
import { CollectionItemLabelContext } from "./collection-item-label";
import { findField } from "./collection-view-fields";
import { countFilterRules } from "./collection-view-filter";
import { FilterRulePill } from "./collection-view-pills";
import { setRuleAt } from "./collection-view-rules";
import { CollectionViewTabs } from "./collection-view-tabs";
import { type CollectionSavedView, type CollectionViewsSource, EMPTY_VIEW_FILTER } from "./collection-view-types";
import { FilterMenu } from "./filter-menu";
import type { RuleValueOption } from "./filter-rule-value";
import {
  type CollectionViewStoreInitialState,
  type CollectionViewStoreState,
  useCollectionViewStore,
} from "./use-collection-view-store";
import { isCollectionViewDirty } from "./use-collection-views";
import { ViewBarPopover } from "./view-bar-popover";
import { ViewSearchField } from "./view-search-field";

export interface CollectionViewBarProps<TSettings> {
  storageKey: string;
  /** Singular resource label used as the subject of boolean predicates. */
  itemLabel?: string;
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
      <Button ref={buttonRef} aria-label={label} variant={count > 0 ? "subtle" : "ghost"} size="2xs" onClick={onClick}>
        <Icon as={icon} />
        {count > 0 ? count : null}
      </Button>
    </Tooltip>
  );
};

/** One view bar for data tables and both kanban displays: saved views, then Search, Filter, and Display. */
export const CollectionViewBar = <TSettings,>(props: CollectionViewBarProps<TSettings>) => {
  const { storageKey, initialState, views, defaultViewId, viewsSource, fields, optionsFor } = props;
  const { search, onSearchChange, searchResultLabel, leading, actions, displayControl, align = "split" } = props;
  const store: CollectionViewStoreState<TSettings> = useCollectionViewStore(storageKey, initialState, (state) => state);
  const { activeViewId, settings, sorts, openMenu, openRuleIndex } = store;
  const filter = normalFilter(store.filter);
  const { activateView, setFilter, setOpenMenu, setOpenRuleIndex, selectRule } = store;
  const activeView = views.find((view) => view.id === activeViewId);
  const state = { settings, filter, sorts };
  const dirty = isCollectionViewDirty(activeView, state);
  const filterFields = fields.filter((field) => field.filterable);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const addFilterRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<RefObject<HTMLButtonElement | null>>(filterButtonRef);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const open = (from: RefObject<HTMLButtonElement | null>) => {
    setAnchor(from);
    setOpenMenu(openMenu === "filter" && anchor === from ? null : "filter");
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
  const showCriteria = dirty || filter.rules.length > 0 || Boolean(filter.groups?.length);
  const addAdvanced = () => {
    setOpenMenu(null);
    setFilter(addAdvancedGroup(filter));
  };

  return (
    <CollectionItemLabelContext.Provider value={props.itemLabel ?? "Item"}>
      <Stack
        data-testid="collection-view-bar"
        gap="0"
        flexShrink={0}
        borderBottomWidth="1px"
        borderColor="border.subtle"
      >
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
            onClick={() => open(filterButtonRef)}
          />
          {countFilterRules(filter) > 0 ? (
            <Button
              size="2xs"
              variant="ghost"
              aria-label="Clear all filters"
              onClick={() => {
                setOpenMenu(null);
                setOpenRuleIndex(null);
                setFilter(EMPTY_VIEW_FILTER);
              }}
            >
              Clear
            </Button>
          ) : null}
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
              {filter.rules.map((rule, index) => (
                <FilterRulePill
                  key={`${index}:${rule.attributeId}`}
                  fields={filterFields}
                  rule={rule}
                  options={optionsForId(rule.attributeId)}
                  open={openRuleIndex === index}
                  onOpenChange={(isOpen) => setOpenRuleIndex(isOpen ? index : null)}
                  onChange={(next) => setFilter(setRuleAt(filter, index, next))}
                  onRemove={() => {
                    setOpenRuleIndex(null);
                    setFilter(setRuleAt(filter, index, undefined));
                  }}
                />
              ))}
              {filter.groups?.map((group, index) => (
                <AdvancedFilterPill
                  key={index}
                  fields={filterFields}
                  group={group}
                  optionsFor={optionsFor}
                  onChange={(next) => setFilter(setAdvancedGroup(filter, index, next))}
                  onRemove={() => setFilter(setAdvancedGroup(filter, index))}
                />
              ))}
              <Button
                ref={addFilterRef}
                aria-label="Add filter"
                size="2xs"
                variant="ghost"
                flexShrink={0}
                onClick={() => open(addFilterRef)}
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
          open={openMenu === "filter"}
          onOpenChange={(isOpen) => setOpenMenu(isOpen ? "filter" : null)}
          anchorRef={anchor}
          width="min(440px, calc(100vw - 32px))"
          padding="0"
          testId="filter-menu-popover"
        >
          <FilterMenu
            fields={filterFields}
            filter={filter}
            optionsFor={optionsFor}
            onSelectRule={selectRule}
            onAddAdvanced={addAdvanced}
          />
        </ViewBarPopover>
      </Stack>
    </CollectionItemLabelContext.Provider>
  );
};
