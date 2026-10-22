import { Box, Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import type { WebviewEditingSession } from "@pstdio/sdk/extensions";
import { ScrollArea, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useEffect, useState, useSyncExternalStore } from "react";
import { WorkbenchThemeProvider } from "../../react";
import {
  createEditingSessionsFixture,
  type EditingDocument,
  type EditingSessionsFixture,
} from "./editing-sessions.fixture";

interface EditingViewProps {
  label: string;
  session: WebviewEditingSession<EditingDocument>;
}

const EditingView = (props: EditingViewProps) => {
  const { label, session } = props;
  const { value, revision, savedRevision } = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [selected, setSelected] = useState(false);
  const [error, setError] = useState("");
  const run = (action: Promise<void>) => {
    setError("");
    void action.catch((error: Error) => setError(error.message));
  };
  return (
    <SimpleCard as="section" aria-label={label} flex="1" minW="0">
      <SimpleCardBody>
        <Stack gap="md">
          <Text textStyle="label/M/medium">{label}</Text>
          <Stack as="label" gap="xs">
            <Text textStyle="label/S/medium">Title</Text>
            <Input
              aria-label={`${label} title`}
              size="sm"
              value={value.title}
              onChange={(event) => run(session.commit([{ path: ["title"], value: event.target.value }]))}
            />
          </Stack>
          <Text as="output" aria-label={`${label} position`}>
            Position: {value.position.x}, {value.position.y}
          </Text>
          <HStack gap="xs" flexWrap="wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                run(
                  session.preview([
                    { path: ["position", "x"], value: value.position.x + 12 },
                    { path: ["position", "y"], value: value.position.y + 24 },
                  ]),
                )
              }
            >
              Preview move
            </Button>
            <Button size="sm" variant="outline" onClick={() => run(session.commit())}>
              Commit move
            </Button>
            <Button size="sm" variant="ghost" onClick={() => run(session.cancel())}>
              Cancel move
            </Button>
          </HStack>
          <HStack gap="xs" flexWrap="wrap">
            <Button size="sm" variant="ghost" onClick={() => setSelected(!selected)}>
              Select locally
            </Button>
            <Text as="output" aria-label={`${label} selection`}>
              {selected ? "Selected" : "Unselected"}
            </Text>
          </HStack>
          <Text color="fg.muted" textStyle="paragraph/S/regular">
            Revision {revision}; saved revision {savedRevision}
          </Text>
          {error ? (
            <Text role="alert" color="fg.error">
              {error}
            </Text>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => run(session.save())}>
            Retry save
          </Button>
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
};

const SaveControls = (props: { fixture: EditingSessionsFixture }) => {
  const { fixture } = props;
  const state = useSyncExternalStore(fixture.subscribe, fixture.getSnapshot);
  return (
    <SimpleCard as="section" aria-label="Persistence">
      <SimpleCardBody>
        <Stack gap="sm">
          <Text textStyle="label/M/medium">Persistence</Text>
          <Text>Saves are {state.held ? "held" : "released"}. Edit either shared view while saving is held.</Text>
          <HStack gap="sm" flexWrap="wrap">
            <Button size="sm" onClick={state.held ? fixture.release : fixture.hold}>
              {state.held ? "Release saves" : "Hold saves"}
            </Button>
            <Button size="sm" variant="outline" disabled={!state.waiting} onClick={fixture.fail}>
              Fail held saves
            </Button>
          </HStack>
          <Text as="output" aria-label="Save counts">
            Started: {state.started}; completed: {state.completed}; held: {state.waiting}
          </Text>
          <Text as="output" aria-label="Saved title">
            Saved title: {state.saved.main.title}
          </Text>
          <Text as="output" aria-label="Saved position">
            Saved position: {state.saved.main.position.x}, {state.saved.main.position.y}
          </Text>
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
};

const EditingSessionsDemo = () => {
  const [scene, setScene] = useState<{
    fixture: EditingSessionsFixture;
    sessions: WebviewEditingSession<EditingDocument>[];
  }>();
  const [error, setError] = useState("");
  useEffect(() => {
    const fixture = createEditingSessionsFixture();
    let active = true;
    const opened: WebviewEditingSession<EditingDocument>[] = [];
    const start = async () => {
      for (const document of ["main", "main", "other"] as const) {
        const session = await fixture.open(document);
        if (!active) {
          await session.close();
          return;
        }
        opened.push(session);
      }
      setScene({ fixture, sessions: opened });
    };
    void start().catch((error: Error) => {
      if (active) setError(error.message);
    });
    return () => {
      active = false;
      fixture.release();
      for (const session of opened) void session.close();
    };
  }, []);
  return (
    <Stack gap="md">
      {scene ? <SaveControls fixture={scene.fixture} /> : <Text>Opening shared views…</Text>}
      {error ? <Text role="alert">{error}</Text> : null}
      <HStack align="stretch" gap="md" flexWrap="wrap">
        {scene?.sessions.map((session, index) => (
          <EditingView key={session.id} session={session} label={["View A", "View B", "Other document"][index]} />
        ))}
      </HStack>
    </Stack>
  );
};

export const EditingSessionsPlayground = () => {
  const [reset, setReset] = useState(0);
  return (
    <WorkbenchThemeProvider>
      <ScrollArea h="100dvh">
        <Box p="lg" bg="bg" color="fg" minH="full">
          <Stack gap="md">
            <HStack justify="space-between" gap="md">
              <Text as="h1" textStyle="heading/M">
                Shared editing sessions
              </Text>
              <Button size="sm" variant="outline" onClick={() => setReset(reset + 1)}>
                Reset demo
              </Button>
            </HStack>
            <Text>
              View A and View B share a document. The third view edits a different document. Commit or cancel a move
              from the view that previewed it. Selection stays local.
            </Text>
            <EditingSessionsDemo key={reset} />
          </Stack>
        </Box>
      </ScrollArea>
    </WorkbenchThemeProvider>
  );
};
