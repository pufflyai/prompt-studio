import { Box, Button, HStack, Text } from "@chakra-ui/react";
import { SearchableMenu } from "@pstdio/ui";
import { ChevronDown, Download, Monitor, SquareTerminal } from "lucide-react";
import { useEffect, useState } from "react";
import {
  DESKTOP_RELEASES_URL,
  type DesktopRelease,
  downloadDescription,
  fetchDesktopRelease,
  preferredDownload,
} from "./desktop-releases";
import { SITE_LINKS } from "./landing-content";
import { useLandingStyles } from "./use-landing-styles";

export const DownloadPicker = () => {
  const styles = useLandingStyles();
  const [release, setRelease] = useState<DesktopRelease>();
  const [selectedId, setSelectedId] = useState<string>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchDesktopRelease(controller.signal)
      .then((result) => {
        setRelease(result);
        setSelectedId(preferredDownload(result.downloads, navigator.userAgent).id);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);

  const selected = release?.downloads.find((download) => download.id === selectedId);

  return (
    <Box css={styles.download}>
      {selected ? (
        <Button asChild variant="primary" size="lg" width="full">
          <a href={selected.url} aria-describedby="download-build">
            <Download />
            Download Prompt Studio
          </a>
        </Button>
      ) : (
        <Button asChild variant="primary" size="lg" width="full">
          <a href={DESKTOP_RELEASES_URL}>
            <Download />
            Download Prompt Studio
          </a>
        </Button>
      )}
      <Text id="download-build" textStyle="label/S/regular" color="fg.muted" aria-live="polite">
        {selected && release
          ? `${selected.platform} · ${selected.architecture} · ${downloadDescription(selected)} · v${release.version} · ${Math.round(selected.size / 1024 / 1024)} MB`
          : "Browse available desktop builds on GitHub."}
      </Text>
      <HStack gap="xs">
        {selected && release && (
          <SearchableMenu
            searchPlaceholder="Find a build"
            emptyState="No builds available"
            showSearch={false}
            width="20rem"
            trigger={
              <Button variant="ghost" size="sm">
                Other platforms
                <ChevronDown />
              </Button>
            }
            items={release.downloads.map((download) => ({
              id: download.id,
              label: `${download.platform} · ${download.architecture} · ${download.format.toUpperCase()}`,
              icon: Monitor,
              isSelected: download.id === selected.id,
              onSelect: () => setSelectedId(download.id),
            }))}
          />
        )}
        <Button asChild variant="ghost" size="sm">
          <a href={SITE_LINKS.readme} target="_blank" rel="noopener">
            <SquareTerminal />
            Use via CLI
          </a>
        </Button>
      </HStack>
      {failed && (
        <Text textStyle="label/S/regular" color="fg.muted">
          Build details are unavailable. The button opens all releases.
        </Text>
      )}
    </Box>
  );
};
