import { Box, Grid, HStack, IconButton, Input, Stack, Text } from "@chakra-ui/react";
import type { PageRef, ResourceRef } from "@pstdio/sdk/extensions";
import { createExampleStore, useExampleStore, usePageResource } from "../example-store";
import { ExampleIcon } from "../icon";
import { exampleDefaults } from "../state-defaults";
import type { ExampleHost, ExampleViewInput } from "../view-context";
import { type BoomboxTrack, boomboxTracks } from "./boombox-data";

const page: PageRef = { extensionId: "pstdio.extension-lab", kind: "page", id: "boombox-resource" };
const resource = (track: BoomboxTrack): ResourceRef => ({ type: "boombox.track", id: track.id, label: track.title });
export const boomboxStore = createExampleStore("boombox", exampleDefaults.boombox);

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
    <ExampleIcon name="AudioWaveform" color="white" size={20} />
  </Box>
);

export const Playlist = (props: { input: ExampleViewInput }) => {
  const { input } = props;
  const state = useExampleStore(boomboxStore);
  const tracks = boomboxTracks.filter(
    (track) =>
      (state.filter !== "Liked songs" || state.likedIds.includes(track.id)) &&
      `${track.title} ${track.artist}`.toLowerCase().includes(state.query.toLowerCase()),
  );
  const activeId = input.resource?.id ?? boomboxTracks[0].id;
  const play = (track: BoomboxTrack) => {
    boomboxStore.setState({ playing: true });
    input.host.navigate({ kind: "page", page, resource: resource(track) });
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
          <ExampleIcon name="SunMedium" color="white" size={44} />
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
            <ExampleIcon name="Clock3" />
          </HStack>
          {state.filter === "Search" ? (
            <Input
              aria-label="Search tracks"
              placeholder="Search tracks"
              value={state.query}
              onChange={(event) => boomboxStore.setState({ query: event.target.value })}
            />
          ) : null}
          {tracks.map((track) => {
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
                  <ExampleIcon name={active && state.playing ? "AudioLines" : "Play"} />
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
                    boomboxStore.setState((current) => ({
                      ...current,
                      likedIds: current.likedIds.includes(track.id)
                        ? current.likedIds.filter((id) => id !== track.id)
                        : [...current.likedIds, track.id],
                    }));
                  }}
                >
                  <ExampleIcon name="Heart" color={state.likedIds.includes(track.id) ? "fg.success" : "fg.muted"} />
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
          <Queue host={input.host} />
        </Box>
      </Grid>
    </Stack>
  );
};

const Queue = (props: { host: ExampleHost }) => {
  const state = useExampleStore(boomboxStore);
  const activeId = usePageResource(props.host)?.id ?? boomboxTracks[0].id;
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
              onClick={() => boomboxStore.setState({ queueIds: state.queueIds.filter((id) => id !== track.id) })}
            >
              <ExampleIcon name="X" />
            </IconButton>
          </HStack>
        ))}
      </Stack>
    </Stack>
  );
};

export const Player = (props: { host: ExampleHost }) => {
  const state = useExampleStore(boomboxStore);
  const activeResource = usePageResource(props.host);
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
            boomboxStore.setState({
              likedIds: liked ? state.likedIds.filter((id) => id !== track.id) : [...state.likedIds, track.id],
            })
          }
        >
          <ExampleIcon name="Heart" color={liked ? "fg.success" : "fg.muted"} />
        </IconButton>
      </HStack>
      <HStack flex="1" justify="center">
        <IconButton
          aria-label="Previous track"
          variant="ghost"
          onClick={() =>
            props.host.navigate({
              kind: "page",
              page,
              resource: resource(
                boomboxTracks[(boomboxTracks.indexOf(track) - 1 + boomboxTracks.length) % boomboxTracks.length],
              ),
            })
          }
        >
          <ExampleIcon name="SkipBack" />
        </IconButton>
        <IconButton
          aria-label={state.playing ? "Pause" : "Play"}
          borderRadius="full"
          bg="fg"
          color="bg"
          onClick={() => boomboxStore.setState({ playing: !state.playing })}
        >
          <ExampleIcon name={state.playing ? "Pause" : "Play"} />
        </IconButton>
        <IconButton
          aria-label="Next track"
          variant="ghost"
          onClick={() =>
            props.host.navigate({
              kind: "page",
              page,
              resource: resource(boomboxTracks[(boomboxTracks.indexOf(track) + 1) % boomboxTracks.length]),
            })
          }
        >
          <ExampleIcon name="SkipForward" />
        </IconButton>
      </HStack>
      <HStack flex="1" justify="end">
        <IconButton
          aria-label="Add current track to queue"
          variant="ghost"
          onClick={() =>
            boomboxStore.setState({
              queueIds: state.queueIds.includes(track.id) ? state.queueIds : [...state.queueIds, track.id],
            })
          }
        >
          <ExampleIcon name="ListMusic" />
        </IconButton>
        <ExampleIcon name="Volume2" color="fg.muted" />
      </HStack>
    </HStack>
  );
};
