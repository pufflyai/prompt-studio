import { Button, Flex, Spinner, Text } from "@chakra-ui/react";
import { createWebviewClient, type GuestHost } from "@pstdio/sdk/extensions";
import { AlertMessage, Header } from "@pstdio/ui";
import { useEffect, useState } from "react";
import { studioChanged } from "../events";
import type { studioCommands } from "../studio-commands";
import type { StudioDraft } from "../studio-state";
import { ArtCanvas } from "./art-canvas";

export const Studio = (props: { host: GuestHost }) => {
  const { host } = props;
  const client = createWebviewClient<typeof studioCommands>(host);
  const [draft, setDraft] = useState<StudioDraft>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    const client = createWebviewClient<typeof studioCommands>(host);
    let active = true;
    let generation = 0;
    const refresh = async () => {
      const request = ++generation;
      try {
        const next = await client.commands["studio.read"]();
        if (active && request === generation) {
          setDraft(next);
          setError(undefined);
        }
      } catch (cause) {
        if (active && request === generation) setError(String(cause));
      }
    };
    const unsubscribe = client.events.subscribe(studioChanged, () => void refresh());
    void refresh();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [host]);
  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError(undefined);
    try {
      await operation();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Flex direction="column" h="full" minH="0" minW="0" bg="bg.subtle" color="fg">
      <Header flexShrink="0" px="sm" gap="xs">
        <Text textStyle="label/M/medium" flex="1" truncate>
          {draft?.id}
        </Text>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy || !draft}
          onClick={() =>
            void run(() =>
              client.commands["studio.set"]({ controlId: "seed", value: Math.random().toString(36).slice(2, 8) }),
            )
          }
        >
          New seed
        </Button>
        {draft?.selected !== "new" && draft ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void run(() => client.commands["studio.delete"]())}
          >
            Delete
          </Button>
        ) : null}
        <Button size="sm" disabled={busy || !draft} onClick={() => void run(() => client.commands["studio.save"]())}>
          Save
        </Button>
      </Header>
      {error ? <AlertMessage status="error">{error}</AlertMessage> : null}
      {draft ? <ArtCanvas recipe={draft.recipe} label={draft.id} /> : <Spinner size="sm" />}
    </Flex>
  );
};
