// Compose the feature-branch graph with its milestone timeline and the selected ticket's details.
import { Box, Flex, Text } from "@chakra-ui/react";
import { type GuestHost, workbenchPanels } from "@pstdio/sdk/extensions";
import {
  type CollectionViewsSource,
  filterRowsByView,
  searchRows,
  useCollectionViewStore,
} from "@pstdio/ui/collection-view";
import type { KanbanRendererSettings } from "@pstdio/ui/kanban-renderer";
import { useState } from "react";
import { stepReview } from "../model/review";
import { AutoBuildButton } from "./auto-build-button";
import { BackgroundMenu } from "./background-menu";
import { Details } from "./details";
import { PlanEditor } from "./plan-editor";
import { PlanGraph } from "./plan-graph";
import { PlanHeader } from "./plan-header";
import { useViewSections } from "./plan-state";
import { PlanUnavailable } from "./plan-unavailable";
import { timelineInitialState, timelineQueryData } from "./timeline-query";
import { useAutoBuild } from "./use-auto-build";
import { type PlanClient, usePlan } from "./use-plan";
import { usePlanActions } from "./use-plan-actions";
import { useTimelineViews } from "./use-timeline-views";
import { visibleTracks } from "./visible-tracks";

interface PlanRootProps {
  host: GuestHost;
  t: (key: string, fallback?: string) => string;
}

export function PlanRoot(props: PlanRootProps) {
  const { host, t } = props;
  const { client, plan, error } = usePlan(host);
  const { source: viewsSource, error: viewsError } = useTimelineViews(client);
  const loadError = error ?? viewsError;
  if (!plan && loadError) return <PlanUnavailable message={loadError} t={t} />;
  if (!plan || !viewsSource) return <Text p="md">{t("timeline.loading", "Loading tickets…")}</Text>;
  return (
    <PlanContent host={host} t={t} client={client} plan={plan} viewsSource={viewsSource} error={error ?? viewsError} />
  );
}

interface PlanContentProps extends PlanRootProps {
  client: PlanClient;
  plan: Awaited<ReturnType<PlanClient["commands"]["timeline.plan.read"]>>;
  viewsSource: CollectionViewsSource<KanbanRendererSettings>;
  error?: string;
}

function PlanContent(props: PlanContentProps) {
  const { host, t, client, plan, viewsSource, error } = props;
  const [search, setSearch] = useState("");
  const autoBuild = useAutoBuild(client);
  const queryData = timelineQueryData(plan, t);
  const filter = useCollectionViewStore(queryData.storageKey, timelineInitialState, (state) => state.filter);
  const filtered = filterRowsByView(queryData.rows, filter, queryData.attributes);
  const matching = searchRows(filtered, search, (row) => [row.title, String(row.attributes.id)]);
  const tracks = visibleTracks(plan, filter, queryData.attributes);
  const { sections, toggle } = useViewSections(plan, new Set(matching.map(({ id }) => id)));
  const {
    viewProps,
    selected,
    open,
    review,
    editor,
    context,
    actionError,
    setSelectedId,
    setContext,
    setEditor,
    done,
  } = usePlanActions({ host, client, plan, sections, tracks, toggle });
  return (
    <Flex direction="column" h="full" minH="0" minW="0">
      <PlanHeader
        data={queryData}
        viewsSource={viewsSource}
        search={search}
        onSearchChange={setSearch}
        resultLabel={`${sections.reduce((total, section) => total + section.rows.length, 0)} of ${filtered.length}`}
        actions={
          <AutoBuildButton
            enabled={autoBuild.mode?.enabled ?? false}
            completed={autoBuild.mode?.completed}
            supervisor={autoBuild.mode?.supervisor}
            sessions={autoBuild.mode?.sessions ?? []}
            running={autoBuild.mode?.capacity.running ?? 0}
            capacity={autoBuild.mode?.capacity.limit ?? 0}
            stuck={autoBuild.mode?.stuck}
            error={autoBuild.error}
            onOpenSession={(session) =>
              void host.call("navigation.open", {
                target: {
                  kind: "panel",
                  panel: workbenchPanels.projectSession,
                  open: "preview",
                  resource: { type: "session", id: session.id, extensionId: "pstdio", label: session.title },
                },
              })
            }
            disabled={!autoBuild.mode || autoBuild.saving}
            configuration={
              autoBuild.mode
                ? {
                    prompt: autoBuild.mode.prompt,
                    ignore: autoBuild.mode.ignore,
                    requireMergedDependencies: autoBuild.mode.requireMergedDependencies,
                    eligible: autoBuild.mode.eligible,
                    data: queryData,
                    saving: autoBuild.saving,
                    error: autoBuild.error,
                    onEnable: (prompt, ignore, requireMergedDependencies, eligible) =>
                      autoBuild.configure(true, prompt, ignore, requireMergedDependencies, eligible),
                  }
                : undefined
            }
            onTurnOff={() => autoBuild.configure(false)}
            t={t}
          />
        }
      />
      {[error, actionError, autoBuild.mode ? undefined : autoBuild.error].filter(Boolean).map((message) => (
        <Text key={message} role="alert" color="fg.error" px="md" pt="sm" flexShrink="0">
          {message}
        </Text>
      ))}
      <Flex flex="1" minH="0" minW="0">
        <Box flex="1" minH="0" minW="0">
          <PlanGraph {...viewProps} today={plan.today} />
        </Box>
        {selected ? (
          <Details
            key={selected.id}
            row={selected}
            plan={plan}
            client={client}
            onOpen={open}
            onSelect={setSelectedId}
            onClose={() => setSelectedId(undefined)}
            review={
              review?.includes(selected.id)
                ? {
                    position: review.indexOf(selected.id) + 1,
                    total: review.length,
                    onStep: (direction) => setSelectedId(stepReview(review, selected.id, direction)),
                  }
                : undefined
            }
          />
        ) : null}
      </Flex>
      {editor ? (
        <PlanEditor
          key={JSON.stringify(editor)}
          host={host}
          t={t}
          editor={editor}
          client={client}
          plan={plan}
          onDone={done}
        />
      ) : null}
      {context ? (
        <BackgroundMenu
          context={context}
          onClose={() => setContext(undefined)}
          onCreate={(kind, defaults) => {
            setContext(undefined);
            setEditor({ kind, context: defaults });
          }}
        />
      ) : null}
    </Flex>
  );
}
