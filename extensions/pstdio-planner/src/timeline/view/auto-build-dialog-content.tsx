import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import { Header, installPrismGlobal, ScrollArea } from "@pstdio/ui";
import { lazy, Suspense, useState } from "react";
import { AutoBuildActivityContent } from "./auto-build-activity";
import type { AutoBuildButtonProps } from "./auto-build-button";
import { AutoBuildHelp } from "./auto-build-help";
import { RequestWindowControls } from "./request-window";
import { RequestsPanel } from "./requests-panel";

const AutoBuildForm = lazy(async () => {
  await installPrismGlobal();
  return import("./auto-build-form").then((module) => ({ default: module.AutoBuildForm }));
});

export function AutoBuildDialogContent(props: AutoBuildButtonProps & { onClose?: () => void }) {
  const { disabled, configuration, t } = props;
  // Mount only after the initial authoritative mode arrives, then retain the chosen panel.
  if (disabled && !configuration) return <Text p="md">Loading Auto Build…</Text>;
  return (
    <Stack h="full" minH="0" gap="0">
      <Header variant="narrow">
        <Box flex="1" />
        <AutoBuildHelp t={t} />
      </Header>
      <Box flex="1" minH="0">
        <AutoBuildPanels {...props} />
      </Box>
    </Stack>
  );
}

function AutoBuildPanels(props: AutoBuildButtonProps & { onClose?: () => void }) {
  const {
    completed,
    supervisor,
    error,
    enabled,
    paused,
    t,
    configuration,
    reviewRequests = [],
    requestErrors = [],
    onAnswerRequest,
    onOpenRequestChat,
    onOpenSession,
    onStop,
    onClose,
  } = props;
  const failed = (!completed && supervisor?.status === "failed") || Boolean(error);
  const [panel, setPanel] = useState(enabled || paused || failed ? "activity" : "configuration");
  if (panel === "configuration" && configuration) {
    return (
      <Flex direction="column" h="full" minH="0">
        <Suspense fallback={<Text p="md">Loading Auto Build…</Text>}>
          <AutoBuildForm {...configuration} onClose={() => onClose?.()} t={t} />
        </Suspense>
      </Flex>
    );
  }
  if (panel === "requests") {
    return (
      <Stack h="full" minH="0" gap="0">
        <Box p="sm">
          <Button size="xs" variant="ghost" onClick={() => setPanel("activity")}>
            {t("timeline.autoBuild.back", "Back")}
          </Button>
        </Box>
        <ScrollArea flex="1" minH="0" contentProps={{ p: "sm" }}>
          <RequestsPanel
            row={{ requests: reviewRequests, requestErrors }}
            heading={false}
            pendingOnly
            onAnswer={async (id, response) => {
              if (!onAnswerRequest) throw new Error("Answering requests is unavailable.");
              return onAnswerRequest(id, response);
            }}
            onOpenChat={async (id) => {
              if (!onOpenRequestChat) throw new Error("Opening a session is unavailable.");
              const result = await onOpenRequestChat(id);
              onClose?.();
              return result;
            }}
          />
        </ScrollArea>
        {props.requestPage && props.onRequestPage ? (
          <RequestWindowControls
            result={props.requestPage}
            offset={props.requestPage.offset}
            move={props.onRequestPage}
            loading={props.requestLoading}
          />
        ) : null}
      </Stack>
    );
  }
  return (
    <Flex direction="column" h="full" minH="0">
      <AutoBuildActivityContent
        {...props}
        failed={failed}
        onStop={() => void onStop().then((saved) => saved && onClose?.())}
        onOpenSession={async (session) => {
          await onOpenSession(session);
          onClose?.();
        }}
        onConfigure={() => setPanel("configuration")}
        onOpenRequests={() => setPanel("requests")}
      />
    </Flex>
  );
}
