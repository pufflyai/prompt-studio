import { Button, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useCommandMutation, useCommandQuery } from "@pstdio/sdk/extensions/react";
import { ScrollArea, SegmentedControl } from "@pstdio/ui";
import { useState } from "react";
import { Ideas, Threads } from "./digest-sections";
import { useRadarCommand } from "./host";
import type { Idea, Run, Thread } from "./schemas";
import { Settings } from "./settings-panel";

export const Digest = () => {
  const command = useRadarCommand();
  const [section, setSection] = useState("threads");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const digest = useCommandQuery({
    queryKey: ["digest"],
    command: () => command<{ run: Run | null; threads: Thread[]; ideas: Idea[] }>("list-digest"),
  });
  const posted = useCommandQuery({
    queryKey: ["posted"],
    command: () => command<{ threads: Thread[] }>("list-posted"),
  });
  const run = useCommandMutation({ command: () => command("run-daily"), invalidate: [["digest"]] });
  const threadStatus = useCommandMutation({
    command: (input: { id: string; status: string }) => command("set-thread-status", input),
    invalidate: [["digest"], ["posted"]],
  });
  const ideaStatus = useCommandMutation({
    command: (input: { id: string; status: string }) => command("set-idea-status", input),
    invalidate: [["digest"]],
  });
  const error = digest.error ?? posted.error ?? run.error ?? threadStatus.error ?? ideaStatus.error;
  const current = digest.data?.run;
  return (
    <ScrollArea h="full">
      <Stack gap="lg" p="lg">
        <HStack justify="space-between" flexWrap="wrap" gap="sm">
          <Stack gap="xs">
            <Heading as="h1" textStyle="heading/L/bold">
              Social radar
            </Heading>
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              Useful conversations and ready-to-paste drafts. You post them yourself.
            </Text>
          </Stack>
          <HStack gap="sm">
            <Button size="sm" onClick={() => setSettingsOpen(!settingsOpen)}>
              {settingsOpen ? "Close settings" : "Settings"}
            </Button>
            <Button size="sm" loading={run.isPending} onClick={() => run.mutate(undefined)}>
              Run now
            </Button>
          </HStack>
        </HStack>
        {settingsOpen && <Settings />}
        {error && (
          <Text role="alert" color="fg.error" textStyle="paragraph/S/regular">
            {error.message}
          </Text>
        )}
        {digest.isPending && (
          <Text role="status" textStyle="paragraph/S/regular">
            Loading digest…
          </Text>
        )}
        {current && (
          <Stack gap="xs">
            <Text textStyle="label/S/medium">
              {new Date(current.startedAt).toLocaleString()} · {current.status}
            </Text>
            {current.status === "running" && (
              <Text role="status" textStyle="paragraph/S/regular">
                Research is running. Results appear as the agent saves them.
              </Text>
            )}
            {current.summary && <Text textStyle="paragraph/S/regular">{current.summary}</Text>}
            {current.failureReason && (
              <Text role="alert" color="fg.error" textStyle="paragraph/S/regular">
                {current.failureReason}
              </Text>
            )}
            {current.searches && (
              <Text textStyle="label/S/regular" color="fg.muted">
                Searches:{" "}
                {Object.entries(current.searches)
                  .map(([site, count]) => `${site} ${count}`)
                  .join(" · ")}
              </Text>
            )}
            {current.skippedSites?.map((skip) => (
              <Text key={skip.site} textStyle="label/S/regular" color="fg.muted">
                Skipped {skip.site}: {skip.reason}
              </Text>
            ))}
          </Stack>
        )}
        <SegmentedControl
          aria-label="Digest sections"
          value={section}
          onValueChange={setSection}
          options={[
            { label: "Threads", value: "threads" },
            { label: "Ideas", value: "ideas" },
            { label: "Posted", value: "posted" },
          ]}
        />
        {section === "threads" && (
          <Threads
            threads={digest.data?.threads ?? []}
            busy={threadStatus.isPending}
            onStatus={(id, status) => threadStatus.mutate({ id, status })}
          />
        )}
        {section === "ideas" && (
          <Ideas
            ideas={digest.data?.ideas ?? []}
            busy={ideaStatus.isPending}
            onStatus={(id, status) => ideaStatus.mutate({ id, status })}
          />
        )}
        {section === "posted" && <Threads threads={posted.data?.threads ?? []} posted onStatus={() => {}} />}
      </Stack>
    </ScrollArea>
  );
};
