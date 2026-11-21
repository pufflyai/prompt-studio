import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import { Header, installPrismGlobal, ScrollArea } from "@pstdio/ui";
import { lazy, Suspense, useState } from "react";
import { AutoBuildActivityContent } from "./auto-build-activity";
import type { AutoBuildButtonProps } from "./auto-build-button";
import { AutoBuildHelp } from "./auto-build-help";
import { RequestsPanel } from "./requests-panel";

const AutoBuildForm = lazy(async () => {
  await installPrismGlobal();
  return import("./auto-build-form").then((module) => ({ default: module.AutoBuildForm }));
});

export function AutoBuildDialogContent(props: AutoBuildButtonProps & { onClose?: () => void }) {
  // Mount only after the initial authoritative mode arrives, then retain the chosen panel.
  if (props.disabled && !props.configuration) return <Text p="md">Loading Auto Build…</Text>;
  return (
    <Stack h="full" minH="0" gap="0">
      <Header variant="narrow">
        <Box flex="1" />
        <AutoBuildHelp t={props.t} />
      </Header>
      <Box flex="1" minH="0">
        <AutoBuildPanels {...props} />
      </Box>
    </Stack>
  );
}

function AutoBuildPanels(props: AutoBuildButtonProps & { onClose?: () => void }) {
  const failed = (!props.completed && props.supervisor?.status === "failed") || Boolean(props.error);
  const [panel, setPanel] = useState(props.enabled || props.paused || failed ? "activity" : "configuration");
  const t = props.t;
  if (panel === "configuration" && props.configuration) {
    return (
      <Flex direction="column" h="full" minH="0">
        <Suspense fallback={<Text p="md">Loading Auto Build…</Text>}>
          <AutoBuildForm {...props.configuration} onClose={() => props.onClose?.()} t={t} />
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
            row={{ requests: props.reviewRequests ?? [], requestErrors: props.requestErrors ?? [] }}
            heading={false}
            pendingOnly
            onAnswer={async (id, response) => {
              if (!props.onAnswerRequest) throw new Error("Answering requests is unavailable.");
              return props.onAnswerRequest(id, response);
            }}
            onOpenChat={async (id) => {
              if (!props.onOpenRequestChat) throw new Error("Opening a session is unavailable.");
              return props.onOpenRequestChat(id);
            }}
          />
        </ScrollArea>
      </Stack>
    );
  }
  return (
    <Flex direction="column" h="full" minH="0">
      <AutoBuildActivityContent
        {...props}
        failed={failed}
        onStop={() => void props.onStop().then((saved) => saved && props.onClose?.())}
        onConfigure={() => setPanel("configuration")}
        onOpenRequests={() => setPanel("requests")}
      />
    </Flex>
  );
}
