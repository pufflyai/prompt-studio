import { HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import type { WorkbenchCore } from "../../core";
import { WorkbenchIcon } from "../../react";
import { Artwork } from "./boombox-artwork";
import { boomboxTracks } from "./boombox-data";
import { getBoomboxStore } from "./boombox-state";
import { usePrimaryResource, useShowcaseStore } from "./showcase-store";

export const BoomboxQueue = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const store = getBoomboxStore(workbench);
  const state = useShowcaseStore(store);
  const activeId = usePrimaryResource(workbench)?.id;
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
