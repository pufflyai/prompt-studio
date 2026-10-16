// Compose the feature-branch graph with its milestone timeline and the selected ticket's details.
import { Box, Flex, Text } from "@chakra-ui/react";
import { type GuestHost, workbenchPanels } from "@pstdio/sdk/extensions";
import { type HostStorage, HostStorageProvider, installPrismGlobal } from "@pstdio/ui";
import {
  type CollectionViewsSource,
  filterRowsByView,
  searchRows,
  useCollectionViewStore,
} from "@pstdio/ui/collection-view";
import type { KanbanRendererSettings } from "@pstdio/ui/kanban-renderer";
import { lazy, Suspense, useEffect, useState } from "react";
import { stepReview } from "../model/review";
import { AutoBuildButton } from "./auto-build-button";
import { BackgroundMenu } from "./background-menu";
import { PlanGraph } from "./plan-graph";
import { PlanHeader } from "./plan-header";
import { useViewSections } from "./plan-state";
import { reportTimelineError } from "./timeline-notice";
import { timelineInitialState, timelineQueryData } from "./timeline-query";
import { createTimelineStorage } from "./timeline-storage";
import { useAutoBuild } from "./use-auto-build";
import { type PlanClient, usePlan } from "./use-plan";
import { usePlanActions } from "./use-plan-actions";
import { useTimelineViews } from "./use-timeline-views";
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
const AutoBuildDialog = lazy(async () => {
  await installPrismGlobal();
  return import("./auto-build-dialog").then((module) => ({ default: module.AutoBuildDialog }));
});

interface PlanRootProps {
  host: GuestHost;
  t: (key: string, fallback?: string) => string;
}

export function PlanRoot(props: PlanRootProps) {
  const { host, t } = props;
  const { client, plan } = usePlan(host);
  const { source: viewsSource } = useTimelineViews(client);
  const [storage, setStorage] = useState<HostStorage>();
  useEffect(() => {
    let active = true;
    const reportError = (reason: unknown) => {
      if (active) void reportTimelineError(host, reason);
    };
    void createTimelineStorage(host, reportError)
      .then((next) => {
        if (active) setStorage(next);
      })
      .catch(reportError);
    return () => {
      active = false;
    };
  }, [host]);
  if (!plan || !viewsSource || !storage) return <Text p="md">{t("timeline.loading", "Loading tickets…")}</Text>;
  return (
    <HostStorageProvider storage={storage}>
      <PlanContent host={host} t={t} client={client} plan={plan} viewsSource={viewsSource} />
    </HostStorageProvider>
  );
}

interface PlanContentProps extends PlanRootProps {
  client: PlanClient;
  plan: Awaited<ReturnType<PlanClient["commands"]["timeline.plan.read"]>>;
  viewsSource: CollectionViewsSource<KanbanRendererSettings>;
}

function PlanContent(props: PlanContentProps) {
  const { host, t, client, plan, viewsSource } = props;
  const [search, setSearch] = useState("");
  const autoBuild = useAutoBuild(client);
  const [autoBuildOpen, setAutoBuildOpen] = useState(false);
  const queryData = timelineQueryData(plan, t);
  const filter = useCollectionViewStore(queryData.storageKey, timelineInitialState, (state) => state.filter);
  const filtered = filterRowsByView(queryData.rows, filter, queryData.attributes);
  const matching = searchRows(filtered, search, (row) => [row.title, String(row.attributes.id)]);
  const tracks = visibleTracks(plan, filter, queryData.attributes);
  const { sections, toggle } = useViewSections(plan, new Set(matching.map(({ id }) => id)));
  const { viewProps, selected, open, review, editor, context, setSelectedId, setContext, setEditor, done } =
    usePlanActions({ host, client, plan, sections, tracks, toggle });
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
            supervisor={autoBuild.mode?.supervisor}
            sessions={autoBuild.mode?.sessions ?? []}
            running={autoBuild.mode?.capacity.running ?? 0}
            capacity={autoBuild.mode?.capacity.limit ?? 0}
            stuck={autoBuild.mode?.stuck}
            error={autoBuild.mode?.error}
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
            onConfigure={() => {
              void autoBuild.refresh().then((success) => {
                if (success) setAutoBuildOpen(true);
              });
            }}
            onTurnOff={() => autoBuild.configure(false)}
            t={t}
          />
        }
      />
      <Flex flex="1" minH="0" minW="0">
        <Box flex="1" minH="0" minW="0">
          <PlanGraph {...viewProps} today={plan.today} />
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
          </Suspense>
        ) : null}
      </Flex>
      {editor ? (
        <Suspense fallback={null}>
          <PlanEditor
            key={JSON.stringify(editor)}
            host={host}
            t={t}
            editor={editor}
            client={client}
            plan={plan}
            onDone={done}
          />
        </Suspense>
      ) : null}
      {autoBuildOpen ? (
        <Suspense fallback={null}>
          <AutoBuildDialog
            prompt={autoBuild.mode!.prompt}
            ignore={autoBuild.mode!.ignore}
            blockOnReview={autoBuild.mode!.blockOnReview}
            data={queryData}
            saving={autoBuild.saving}
            error={autoBuild.error}
            onEnable={(prompt, ignore, blockOnReview) => autoBuild.configure(true, prompt, ignore, blockOnReview)}
            onClose={() => setAutoBuildOpen(false)}
            t={t}
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
