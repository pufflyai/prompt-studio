import { Box, Grid, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import type { PageRef, ResourceRef } from "@pstdio/sdk/extensions";
import { createWorkbench, type WorkbenchCore, type WorkbenchPanelRenderInput } from "../../core";
import { WorkbenchIcon } from "../../react";
import { type BoomboxTrack, boomboxTracks } from "./boombox-data";
import { BoomboxNav, BoomboxRail } from "./boombox-navigation";
import { createShowcaseStore, usePrimaryResource, useShowcaseStore } from "./showcase-store";
import { boomboxTheme } from "./themes";

const page: PageRef = { extensionId: "storybook.showcases", kind: "page", id: "boombox-resource" };
const homePage: PageRef = { ...page, id: "boombox" };
const resource = (track: BoomboxTrack): ResourceRef => ({ type: "boombox.track", id: track.id, label: track.title });
const store = createShowcaseStore({ playing: true, likedIds: ["paper-moon"], queueIds: ["afterimage", "still-life"] });
const Artwork = (props: { size?: string; track: BoomboxTrack }) => (
  <Box
    flexShrink={0}
    boxSize={props.size ?? "12"}
    borderRadius="md"
    bgGradient="to-br"
    gradientFrom={`${props.track.tint}.500`}
    gradientTo="bg.panel"
    display="grid"
    placeItems="center"
  >
    <WorkbenchIcon name="AudioWaveform" color="white" size={20} />
  </Box>
);
const Playlist = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const state = useShowcaseStore(store);
  const activeId = input.instance.resource?.id ?? boomboxTracks[0].id;
  const play = (track: BoomboxTrack) => {
    store.setState({ playing: true });
    input.workbench.pageLocations.navigate({ kind: "page", page, resource: resource(track) });
  };
  return (
    <Stack h="full" overflow="hidden" bg="bg" gap="0">
      <HStack p={{ base: "lg", md: "xl" }} align="end" bgGradient="to-b" gradientFrom="bg.muted" gradientTo="bg">
        <Box
          boxSize={{ base: "28", md: "40" }}
          borderRadius="lg"
          bgGradient="to-br"
          gradientFrom="purple.500"
          gradientTo="orange.500"
          display="grid"
          placeItems="center"
          boxShadow="lg"
        >
          <WorkbenchIcon name="SunMedium" color="white" size={44} />
        </Box>
        <Stack gap="xs">
          <Text textStyle="label/XS">PLAYLIST</Text>
          <Text textStyle="display/XL/semibold">Lazy Sunday</Text>
          <Text color="fg.muted">Warm electronics for a slow start.</Text>
          <Text textStyle="paragraph/S/semibold">Ari Park · 5 songs · 19 min</Text>
        </Stack>
      </HStack>
      <Grid flex="1" minH="0" gridTemplateColumns={{ base: "minmax(0, 1fr)", xl: "minmax(0, 1fr) 18rem" }}>
        <Stack overflowY="auto" gap="xs" px={{ base: "md", md: "xl" }} py="lg">
          <HStack px="sm" color="fg.muted" textStyle="label/XS">
            <Text w="8">#</Text>
            <Text flex="1">TITLE</Text>
            <Text display={{ base: "none", lg: "block" }} flex="1">
              ALBUM
            </Text>
            <WorkbenchIcon name="Clock3" />
          </HStack>
          {boomboxTracks.map((track) => {
            const active = activeId === track.id;
            return (
              <HStack
                key={track.id}
                p="sm"
                borderRadius="md"
                bg={active ? "bg.active" : undefined}
                _hover={{ bg: "bg.hover" }}
                cursor="pointer"
                onClick={() => play(track)}
              >
                <IconButton
                  aria-label={`Play ${track.title} by ${track.artist}`}
                  size="xs"
                  variant="ghost"
                  color={active ? "fg.success" : "fg.muted"}
                  onClick={(event) => {
                    event.stopPropagation();
                    play(track);
                  }}
                >
                  <WorkbenchIcon name={active && state.playing ? "AudioLines" : "Play"} />
                </IconButton>
                <HStack flex="1" minW="0">
                  <Artwork track={track} />
                  <Stack gap="0" minW="0">
                    <Text truncate color={active ? "fg.success" : "fg"} textStyle="paragraph/S/semibold">
                      {track.title}
                    </Text>
                    <Text truncate color="fg.muted" textStyle="paragraph/XS/regular">
                      {track.artist}
                    </Text>
                  </Stack>
                </HStack>
                <Text display={{ base: "none", lg: "block" }} flex="1" color="fg.muted" textStyle="paragraph/S/regular">
                  {track.album}
                </Text>
                <IconButton
                  aria-label={state.likedIds.includes(track.id) ? `Unlike ${track.title}` : `Like ${track.title}`}
                  size="xs"
                  variant="ghost"
                  onClick={(event) => {
                    event.stopPropagation();
                    store.setState((current) => ({
                      ...current,
                      likedIds: current.likedIds.includes(track.id)
                        ? current.likedIds.filter((id) => id !== track.id)
                        : [...current.likedIds, track.id],
                    }));
                  }}
                >
                  <WorkbenchIcon name="Heart" color={state.likedIds.includes(track.id) ? "fg.success" : "fg.muted"} />
                </IconButton>
                <Text w="10" color="fg.muted" textStyle="paragraph/S/regular">
                  {track.duration}
                </Text>
              </HStack>
            );
          })}
        </Stack>
        <Box
          display={{ base: "none", xl: "block" }}
          minH="0"
          overflowY="auto"
          borderLeftWidth="1px"
          borderColor="border.subtle"
        >
          <Queue workbench={input.workbench} />
        </Box>
      </Grid>
    </Stack>
  );
};
const Queue = (props: { workbench: WorkbenchCore }) => {
  const state = useShowcaseStore(store);
  const activeId = usePrimaryResource(props.workbench)?.id;
  const queued = boomboxTracks.filter((track) => state.queueIds.includes(track.id));
  return (
    <Stack h="full" p="md" gap="lg">
      <Stack gap="xs">
        <Text textStyle="heading/S/semibold">Queue</Text>
        <Text color="fg.muted" textStyle="paragraph/S/regular">
          Playing now
        </Text>
        {boomboxTracks
          .filter((track) => track.id === activeId)
          .map((track) => (
            <HStack key={track.id}>
              <Artwork track={track} />
              <Stack gap="0">
                <Text textStyle="paragraph/S/semibold">{track.title}</Text>
                <Text color="fg.muted" textStyle="paragraph/XS/regular">
                  {track.artist}
                </Text>
              </Stack>
            </HStack>
          ))}
      </Stack>
      <Stack gap="sm">
        <Text color="fg.muted" textStyle="paragraph/S/regular">
          Next up
        </Text>
        {queued.map((track) => (
          <HStack key={track.id}>
            <Artwork track={track} />
            <Stack gap="0" flex="1">
              <Text textStyle="paragraph/S/semibold">{track.title}</Text>
              <Text color="fg.muted" textStyle="paragraph/XS/regular">
                {track.artist}
              </Text>
            </Stack>
            <IconButton
              aria-label={`Remove ${track.title} from queue`}
              size="xs"
              variant="ghost"
              onClick={() => store.setState({ queueIds: state.queueIds.filter((id) => id !== track.id) })}
            >
              <WorkbenchIcon name="X" />
            </IconButton>
          </HStack>
        ))}
      </Stack>
    </Stack>
  );
};
const Player = (props: { workbench: WorkbenchCore }) => {
  const state = useShowcaseStore(store);
  const activeResource = usePrimaryResource(props.workbench);
  const track = boomboxTracks.find((item) => item.id === activeResource?.id) ?? boomboxTracks[0];
  const liked = state.likedIds.includes(track.id);
  return (
    <HStack h="full" px="md" justify="space-between">
      <HStack flex="1" minW="0">
        <Artwork track={track} />
        <Stack gap="0" minW="0">
          <Text truncate textStyle="paragraph/S/semibold">
            {track.title}
          </Text>
          <Text truncate color="fg.muted" textStyle="paragraph/XS/regular">
            {track.artist}
          </Text>
        </Stack>
        <IconButton
          aria-label={liked ? "Unlike current track" : "Like current track"}
          size="xs"
          variant="ghost"
          onClick={() =>
            store.setState({
              likedIds: liked ? state.likedIds.filter((id) => id !== track.id) : [...state.likedIds, track.id],
            })
          }
        >
          <WorkbenchIcon name="Heart" color={liked ? "fg.success" : "fg.muted"} />
        </IconButton>
      </HStack>
      <HStack flex="1" justify="center">
        <IconButton aria-label="Previous track" variant="ghost">
          <WorkbenchIcon name="SkipBack" />
        </IconButton>
        <IconButton
          aria-label={state.playing ? "Pause" : "Play"}
          borderRadius="full"
          bg="fg"
          color="bg"
          onClick={() => store.setState({ playing: !state.playing })}
        >
          <WorkbenchIcon name={state.playing ? "Pause" : "Play"} />
        </IconButton>
        <IconButton aria-label="Next track" variant="ghost">
          <WorkbenchIcon name="SkipForward" />
        </IconButton>
      </HStack>
      <HStack flex="1" justify="end">
        <IconButton
          aria-label="Add current track to queue"
          variant="ghost"
          onClick={() =>
            store.setState({
              queueIds: state.queueIds.includes(track.id) ? state.queueIds : [...state.queueIds, track.id],
            })
          }
        >
          <WorkbenchIcon name="ListMusic" />
        </IconButton>
        <WorkbenchIcon name="Volume2" color="fg.muted" />
      </HStack>
    </HStack>
  );
};
export const createBoomboxWorkbench = () => {
  const workbench = createWorkbench({ startPage: homePage });
  workbench.themes.register([boomboxTheme]);
  workbench.modes.registerMode({
    id: "boombox",
    label: "Boombox",
    chrome: { nav: "boombox.nav", sidenav: false, activity: "boombox.rail" },
    resourceKinds: ["boombox.track"],
    regionSettings: {
      secondary: { size: { defaultPx: 88, minPx: 88, maxPx: 88 }, collapsible: false, showHeader: false },
    },
    activate: () => undefined,
  });
  workbench.views.registerView({
    id: "boombox.nav",
    title: "Boombox",
    body: { kind: "react", render: () => <BoomboxNav /> },
  });
  workbench.views.registerView({
    id: "boombox.rail",
    title: "Library",
    body: { kind: "react", render: () => <BoomboxRail /> },
  });
  workbench.views.registerView({
    id: "boombox.playlist",
    title: "Lazy Sunday",
    body: { kind: "react", render: (input) => <Playlist input={input} /> },
  });
  workbench.views.registerView({
    id: "boombox.player",
    title: "Player",
    body: { kind: "react", render: (input) => <Player workbench={input.workbench} /> },
  });
  workbench.modePlacements.registerPlacement({
    id: "boombox.player",
    ref: { extensionId: "storybook.showcases", kind: "placement", id: "boombox.player" },
    modeId: "boombox",
    region: "secondary",
    item: {
      kind: "view",
      presence: "fixed",
      view: {
        kind: "view",
        id: "boombox.player",
      },
    },
  });
  workbench.pages.registerPage({
    id: "boombox.home",
    ref: homePage,
    title: "Lazy Sunday",
    path: "boombox",
    modeId: "boombox",
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: "boombox.playlist",
      },
      cardinality: "one",
    },
    slots: [],
  });
  workbench.pages.registerPage({
    id: "boombox.resource",
    ref: page,
    title: "Lazy Sunday",
    path: "boombox/resource",
    modeId: "boombox",
    parentId: "boombox.home",
    resource: {
      kinds: [
        {
          kind: "resource-kind",
          id: "boombox.track",
        },
      ],
    },
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: "boombox.playlist",
      },
      cardinality: "one",
    },
    slots: [],
  });
  workbench.pageLocations.switchProject("storybook-boombox");
  workbench.pageLocations.navigate({ kind: "page", page, resource: resource(boomboxTracks[0]) });
  return workbench;
};
