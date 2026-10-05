import { Box, Button, Center, HStack, Text } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import { CirclePause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { pausedExtensions } from "../paused-extensions";

// Below this height a view is chrome (a header or status bar), so the placeholder
// shrinks to one line instead of a centered empty state.
const COMPACT_MAX_HEIGHT = 160;

interface PausedExtensionViewProps {
  installedExtensionId: string;
  name: string;
}

// Takes the place of every view of an extension paused from the performance
// monitor. The view keeps its tab and place, so Resume brings it back in place.
export const PausedExtensionView = (props: PausedExtensionViewProps) => {
  const { installedExtensionId, name } = props;
  const { t } = useTranslation("settings");
  const container = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setCompact((entry?.contentRect.height ?? 0) < COMPACT_MAX_HEIGHT));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const resume = () => pausedExtensions.resume(installedExtensionId);

  return (
    <Box ref={container} h="full" w="full" data-testid="paused-extension-view">
      {compact ? (
        <HStack h="full" paddingX="sm" gap="xs" color="fg.muted">
          <CirclePause size={14} />
          <Text textStyle="label/S/regular" truncate>
            {t("performance.paused.title", { name })}
          </Text>
          <Button size="2xs" variant="ghost" onClick={resume}>
            <Play />
            {t("performance.popover.resume")}
          </Button>
        </HStack>
      ) : (
        <Center h="full">
          <EmptyState
            icon={<CirclePause />}
            title={t("performance.paused.title", { name })}
            description={t("performance.paused.body")}
          >
            <Button size="sm" variant="outline" onClick={resume}>
              <Play />
              {t("performance.popover.resume")}
            </Button>
          </EmptyState>
        </Center>
      )}
    </Box>
  );
};
