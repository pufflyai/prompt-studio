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
  const loading = !release && !failed;
  let description = "Finding a desktop build for your platform.";
  if (release) description = "The desktop app is not available on this platform yet.";
  if (selected && release) {
    description = `${selected.platform} · ${selected.architecture} · ${downloadDescription(selected)} · v${release.version} · ${Math.round(selected.size / 1024 / 1024)} MB`;
  }
  if (failed) description = "Desktop downloads could not be loaded. Use the CLI instructions or browse releases.";

  return (
    <Box css={styles.download}>
      {loading ? (
        <Button variant="primary" size="lg" width="full" disabled aria-describedby="download-build">
          <Download />
          Checking downloads…
        </Button>
      ) : (
        <Button asChild variant="primary" size="lg" width="full">
          <a href={selected?.url ?? SITE_LINKS.readme} aria-describedby="download-build">
            {selected ? <Download /> : <SquareTerminal />}
            {selected ? "Download Prompt Studio" : "Use via CLI"}
          </a>
        </Button>
      )}
      <Text id="download-build" textStyle="label/S/regular" color="fg.muted" aria-live="polite">
        {description}
      </Text>
      <HStack gap="xs">
        {release && (
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
              isSelected: download.id === selected?.id,
              onSelect: () => selectDownload(download.id),
            }))}
          />
        )}
        {selected && (
          <Button asChild variant="ghost" size="sm">
            <a href={SITE_LINKS.readme} target="_blank" rel="noopener">
              <SquareTerminal />
              Use via CLI
            </a>
          </Button>
        )}
        {failed && (
          <Button asChild variant="ghost" size="sm">
            <a href={DESKTOP_RELEASES_URL}>Browse releases</a>
          </Button>
        )}
      </HStack>
    </Box>
  );
};
