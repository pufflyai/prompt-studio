// Compose the feature-branch graph with its milestone timeline and the selected ticket's details.
import { Box, Flex, Text } from "@chakra-ui/react";
import type { GuestHost } from "@pstdio/sdk/extensions";
import { useKanbanRendererStore } from "@pstdio/ui/kanban-renderer";
import { useState } from "react";
import { stepReview } from "../model/review";
import { BackgroundMenu } from "./background-menu";
import { Details } from "./details";
import { PlanEditor } from "./plan-editor";
import { PlanGraph } from "./plan-graph";
import { PlanHeader } from "./plan-header";
import { useViewSections } from "./plan-state";
import { timelineQueryData } from "./timeline-query";
import { useDisplay } from "./use-display";
import { usePlan } from "./use-plan";
import { usePlanActions } from "./use-plan-actions";

export function PlanRoot(props: { host: GuestHost; t: (key: string, fallback?: string) => string }) {
  const { host, t } = props;
  const { client, plan, error } = usePlan(host);
  const { display, update, error: displayError } = useDisplay(client);
  const [search, setSearch] = useState("");
  const queryData = timelineQueryData(plan);
  const filters = useKanbanRendererStore(queryData.storageKey, (state) => state.filters);
  const query = { search, filters, tags: plan?.tags ?? [] };
  const { sections, tracks, toggle } = useViewSections(plan, display, query);
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
        display={display}
        onDisplayChange={update}
        search={search}
        onSearchChange={setSearch}
        resultLabel={`${sections.reduce((total, section) => total + section.rows.length, 0)} of ${queryData.rows.length}`}
      />
      {[error, displayError, actionError].filter(Boolean).map((message) => (
        <Text key={message} role="alert" color="fg.error" px="md" pt="sm" flexShrink="0">
          {message}
        </Text>
      ))}
      {plan ? (
        <Flex flex="1" minH="0" minW="0">
          <Box flex="1" minH="0" minW="0">
            <PlanGraph {...viewProps} today={plan.today} squareArrows={display.squareArrows} />
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
      ) : (
        !error && <Text p="md">Loading tickets…</Text>
      )}
      {editor && plan ? (
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
