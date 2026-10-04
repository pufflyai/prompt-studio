import { Box, Flex, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import type { GuestHost } from "@pstdio/sdk/extensions";
import { Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import type { ShaderConfig } from "./configs";
import { ShaderSurface } from "./shader-surface";
import { findShader } from "./shaders/definitions";
import { TicketCard, WorkspaceContainer } from "./surfaces";
import { type Clock, createClock, useClockSeconds } from "./use-clock";
import { useVersions } from "./use-versions";

const themes = ["light", "dark"] as const;

interface ThemePaneProps {
  theme: (typeof themes)[number];
  config: ShaderConfig;
  clock: Clock;
}

const ElapsedSeconds = (props: { clock: Clock }) => {
  const { clock } = props;
  return useClockSeconds(clock);
};

// Each pane fills its share of the preview and sets its own theme class, so both themes render side by side with the same values.
const ThemePane = (props: ThemePaneProps) => {
  const { theme, config, clock } = props;
  const surface = <ShaderSurface shader={config.shader} values={config.values} clock={clock} theme={theme} />;
  return (
    <Flex
      className={theme}
      data-theme={theme}
      flex="1"
      minW="0"
      minH="0"
      bg="bg.subtle"
      color="fg"
      p="md"
      align="center"
      justify="center"
    >
      <Stack w="full" maxW="420px" gap="sm">
        <WorkspaceContainer surface={surface} elapsed={<ElapsedSeconds clock={clock} />} />
        <TicketCard id="PS-461" title="Build motion studies for chat" surface={surface} active />
        <TicketCard id="PS-458" title="Review panel timings" />
      </Stack>
    </Flex>
  );
};

const VersionRow = (props: { config: ShaderConfig; clock: Clock }) => {
  const { config, clock } = props;
  return (
    <Flex direction="column" flex="1" minH="0">
      <Text px="sm" py="2xs" textStyle="label/XS/medium" color="fg.muted" borderBottomWidth="1px" borderColor="border">
        {config.name}
      </Text>
      <Flex flex="1" minH="0" borderBottomWidth="1px" borderColor="border">
        {themes.map((theme) => (
          <ThemePane key={theme} theme={theme} config={config} clock={clock} />
        ))}
      </Flex>
    </Flex>
  );
};

export const ShaderPreview = (props: { host: GuestHost; versionId?: string }) => {
  const { host, versionId } = props;
  const { versions, error } = useVersions(host, versionId);
  const [playing, setPlaying] = useState(true);
  const [clock] = useState(createClock);
  useEffect(() => {
    if (!playing) return;
    const update = () => (document.hidden ? clock.pause() : clock.play());
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      clock.pause();
    };
  }, [clock, playing]);
  const shader = versions?.[0] ? findShader(versions[0].shader) : undefined;
  return (
    <Flex direction="column" h="full" w="full" minH="0" minW="0" overflow="hidden" bg="bg" color="fg">
      <HStack flexShrink="0" px="sm" py="2xs" gap="xs" borderBottomWidth="1px" borderColor="border">
        <IconButton
          size="2xs"
          variant="ghost"
          aria-label={playing ? "Pause" : "Play"}
          title={playing ? "Pause" : "Play"}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? <Pause /> : <Play />}
        </IconButton>
        <Text textStyle="label/XS/regular">{shader?.title}</Text>
        <Text textStyle="label/XS/regular" color="fg.muted" truncate>
          {shader?.description}
        </Text>
        <Box flex="1" />
        {error && (
          <Text textStyle="label/XS/regular" color="fg.error" truncate>
            {error}
          </Text>
        )}
      </HStack>
      {/* Shown versions share the full height, so a single version fills the whole preview. */}
      <Flex direction="column" flex="1" minH="0">
        {versions?.map((config) => (
          <VersionRow key={config.id} config={config} clock={clock} />
        ))}
        {versions?.length === 0 && (
          <Flex flex="1" align="center" justify="center">
            <Text textStyle="label/S/regular" color="fg.muted">
              Add a shader from the Shaders list.
            </Text>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
};
