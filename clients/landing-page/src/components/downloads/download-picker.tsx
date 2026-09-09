import { Box, Button, HStack, Text } from "@chakra-ui/react";
import { SearchableMenu } from "@pstdio/ui";
import { ChevronDown, Download, Monitor, SquareTerminal } from "lucide-react";
import { SITE_LINKS } from "../../content/landing-content";
import { useDesktopDownloads } from "../../hooks/use-desktop-downloads";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { DESKTOP_RELEASES_URL } from "../../services/desktop-releases";
import { downloadDescription } from "../../services/release-assets";

export const DownloadPicker = () => {
  const styles = useLandingStyles();
  const { release, selected, failed, selectDownload } = useDesktopDownloads();

  return (
    <Box css={styles.download}>
      <Button asChild variant="primary" size="lg" width="full">
        <a href={selected?.url ?? DESKTOP_RELEASES_URL} aria-describedby="download-build">
          <Download />
          Download Prompt Studio
        </a>
      </Button>
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
              onSelect: () => selectDownload(download.id),
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
