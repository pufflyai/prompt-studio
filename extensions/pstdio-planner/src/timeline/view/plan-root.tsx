// Compose the feature-branch graph with its milestone timeline and the selected ticket's details.
import { Box, Flex, Stack } from "@chakra-ui/react";
import { createWebviewQueryClient, type GuestHost } from "@pstdio/sdk/extensions";
import { useWebviewScope } from "@pstdio/sdk/extensions/react";
import { type HostStorage, HostStorageProvider, installPrismGlobal } from "@pstdio/ui";
import { type CollectionViewsSource, useCollectionViewStore, useCollectionViews } from "@pstdio/ui/collection-view";
import type { KanbanRendererSettings } from "@pstdio/ui/kanban-renderer";
import { lazy, Suspense, useEffect, useState } from "react";
import { PlannerReadError } from "../../views/planner-read-error";
import { BackgroundMenu } from "./background-menu";
import { formatDay } from "./flags";
import { PlanGraph } from "./plan-graph";
import { PlanHeader } from "./plan-header";
import { PlanLoading, PlanLoadingBody } from "./plan-loading";
import { useViewSections } from "./plan-state";
import { TicketRequestsDialog } from "./ticket-requests-dialog";
import { TimelinePresentationProvider } from "./timeline-presentation";
import { timelineInitialState, timelineQueryData } from "./timeline-query";
import { createTimelineStorage } from "./timeline-storage";
import { timelineViewsSource } from "./timeline-views";
import { type PlanClient, usePlan } from "./use-plan";
import { usePlanActions } from "./use-plan-actions";
import { usePlanWindow } from "./use-plan-window";
import { visibleTracks } from "./visible-tracks";

// Published UI panels can import editor code that requires Prism before module evaluation.
const Details = lazy(async () => {
  await installPrismGlobal();
  return import("./details").then((module) => ({ default: module.Details }));
});
const PlanEditor = lazy(async () => {
  await installPrismGlobal();
  return import("./plan-editor").then((module) => ({ default: module.PlanEditor }));
});

interface PlanRootProps {
  host: GuestHost;
  t: (key: string, fallback?: string) => string;
}

export function PlanRoot(props: PlanRootProps) {
  const scope = useWebviewScope(createWebviewQueryClient(props.host));
  return <ProjectPlanRoot key={scope} {...props} />;
}

function ProjectPlanRoot(props: PlanRootProps) {
  const { host, t } = props;
  const { client, plan, error, retry } = usePlan(host);
  // Restore project presentation before mounting controls or applying collapsed geometry.
  const [storage, setStorage] = useState<HostStorage>();
  const [storageError, setStorageError] = useState<Error>();
  const [storageAttempt, retryStorage] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry reloads storage on the same host.
  useEffect(() => {
    let active = true;
    setStorageError(undefined);
    void createTimelineStorage(host, (error) => console.warn("Could not save Timeline preferences", error))
      .then((next) => {
        if (active) setStorage(next);
      })
      .catch((reason: unknown) => {
        if (active) setStorageError(reason instanceof Error ? reason : new Error(String(reason)));
      });
    return () => {
      active = false;
    };
  }, [host, storageAttempt]);
  const viewsSource = plan ? timelineViewsSource(client, plan.savedViews) : undefined;
  return (
    <Stack h="full" minH="0" gap="0" position="relative">
      <PlannerReadError
        error={error ?? storageError}
        retry={error ? retry : () => retryStorage((attempt) => attempt + 1)}
      />
      <Box flex="1" minH="0">
        {plan && storage && viewsSource ? (
          <HostStorageProvider storage={storage}>
            <TimelinePresentationProvider key={plan.projectId} projectId={plan.projectId} storage={storage}>
              <PlanContent host={host} t={t} client={client} plan={plan} viewsSource={viewsSource} />
            </TimelinePresentationProvider>
          </HostStorageProvider>
        ) : null}
        {(!plan || !storage) && !error && !storageError ? <PlanLoading t={t} /> : null}
      </Box>
    </Stack>
  );
}

interface PlanContentProps extends PlanRootProps {
  client: PlanClient;
  plan: Awaited<ReturnType<PlanClient["commands"]["timeline.plan.schema"]>>;
  viewsSource: CollectionViewsSource<KanbanRendererSettings>;
}

function PlanContent(props: PlanContentProps) {
  const { host, t, client, plan: schema, viewsSource } = props;
  const [search, setSearch] = useState("");
  const [attention, setAttention] = useState<{
    kind: "ticket" | "milestone";
    id: string | null;
    open: boolean;
    pendingOnly: boolean;
    trigger: HTMLElement | null;
    fallback?: HTMLElement | null;
  }>();
  const querySchema = timelineQueryData(schema, t);
  const filter = useCollectionViewStore(querySchema.storageKey, timelineInitialState, (state) => state.filter);
  const { views } = useCollectionViews({
    storageKey: querySchema.storageKey,
    fields: querySchema.attributes,
    initialState: timelineInitialState,
    viewsSource,
  });
  const activeViewId = useCollectionViewStore(
    querySchema.storageKey,
    timelineInitialState,
    (state) => state.activeViewId,
  );
  const ready = views.some(({ id }) => id === activeViewId);
  const { plan, paging, error: windowError, retry: retryWindow } = usePlanWindow(client, filter, search, ready);
  const attentionSection = plan?.sections.find(({ deadline }) => (deadline?.id ?? null) === attention?.id);
  const attentionRows =
    attention?.kind === "milestone"
      ? (attentionSection?.rows ?? [])
      : (plan?.sections ?? []).flatMap(({ rows }) => rows).filter(({ id }) => id === attention?.id);
  const attentionTitle =
    attention?.kind === "milestone"
      ? (attentionSection?.deadline?.name ??
        (attentionSection?.deadline ? formatDay(attentionSection.deadline.date) : "Unscheduled"))
      : attentionRows.map(({ shorthand, title }) => `${shorthand} · ${title}`).join("");
  const queryData = timelineQueryData(plan ?? schema, t, (target) => void host.call("navigation.open", { target }));
  const displayProperties = useCollectionViewStore(
    queryData.storageKey,
    timelineInitialState,
    (state) => state.settings.displayProperties,
  );
  const tracks = visibleTracks(plan, filter, queryData.attributes);
  const { sections, toggle } = useViewSections(plan, new Set(queryData.rows.map(({ id }) => id)), true);
  const {
    viewProps,
    selected,
    selectionError,
    retrySelection,
    open,
    editor,
    context,
    setSelectedId,
    setContext,
    setEditor,
    done,
  } = usePlanActions({
    host,
    client,
    plan,
    sections,
    tracks,
    toggle,
    onReview: (id, trigger, fallback) =>
      setAttention({
        kind: "milestone",
        id,
        open: true,
        pendingOnly: true,
        trigger,
        fallback,
      }),
  });
  return (
    <Flex direction="column" h="full" minH="0" minW="0">
      <PlannerReadError error={windowError} retry={retryWindow} />
      <PlannerReadError error={selectionError} retry={retrySelection} />
      <PlanHeader
        data={queryData}
        viewsSource={viewsSource}
        views={views}
        search={search}
        onSearchChange={setSearch}
        resultLabel={plan ? `${plan.page.filteredTotal} of ${plan.page.total}` : ""}
      />
      {plan ? (
        <Flex flex="1" minH="0" minW="0">
          <Box flex="1" minH="0" minW="0">
            <PlanGraph
              {...viewProps}
              paging={paging}
              today={plan.today}
              cardInteraction={{
                host,
                client,
                attributes: queryData.attributes,
                displayProperties,
                rows: new Map(queryData.rows.map((row) => [row.id, row])),
              }}
              onOpenRequests={(row) => {
                viewProps.onSelect(row.id);
                setAttention({
                  pendingOnly: row.reviewCounts
                    ? row.reviewCounts.pending > 0
                    : row.requests.some(({ state }) => state === "open"),
                  kind: "ticket",
                  id: row.id,
                  open: true,
                  trigger: document.activeElement as HTMLElement | null,
                });
              }}
            />
          </Box>
          {selected ? (
            <Suspense fallback={null}>
              <Details
                key={selected.id}
                row={selected}
                plan={plan}
                client={client}
                onOpen={open}
                onSelect={setSelectedId}
                onClose={() => setSelectedId(undefined)}
              />
            </Suspense>
          ) : null}
        </Flex>
      ) : (
        <PlanLoadingBody t={t} />
      )}
      {plan && attention ? (
        <TicketRequestsDialog
          key={`${attention.kind}:${attention.id}`}
          rows={attentionRows}
          source={{
            client,
            scope: attention.kind === "ticket" ? { ticketId: attention.id! } : { deadlineId: attention.id },
          }}
          title={attentionTitle}
          open={attention.open}
          pendingOnly={attention.pendingOnly}
          trigger={attention.trigger}
          fallback={attention.fallback}
          onClose={() => setAttention({ ...attention, open: false })}
          onAnswer={(requestId, response) => client.commands.review({ requestId, response })}
          onOpenChat={(requestId) => client.commands["review-requests.open"]({ requestId })}
        />
      ) : null}
      {plan && editor ? (
        <Suspense fallback={null}>
          <PlanEditor
            key={JSON.stringify(editor)}
            host={host}
            t={t}
            editor={editor}
            client={client}
            plan={plan}
            projectId={schema.projectId}
            onDone={done}
          />
        </Suspense>
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
