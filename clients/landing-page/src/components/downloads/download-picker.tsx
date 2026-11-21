import { Box, Button, HStack, Text } from "@chakra-ui/react";
import { SearchableMenu } from "@pstdio/ui";
import { ChevronDown, Download, SquareTerminal } from "lucide-react";
import { SITE_LINKS } from "../../content/landing-content";
import { useDesktopDownloads } from "../../hooks/use-desktop-downloads";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { DESKTOP_RELEASES_URL } from "../../services/desktop-releases";
import { platformIcon } from "../icons/os-logo";

export const DownloadPicker = () => {
  const styles = useLandingStyles();
  const { release, selected, failed, selectDownload } = useDesktopDownloads();
  const loading = !release && !failed;
  let description = "Finding a desktop build for your platform.";
  if (release) description = "The desktop app is not available on this platform yet.";
  if (selected && release) {
    description = `v${release.version} · ${selected.architecture} · ${Math.round(selected.size / 1024 / 1024)} MB`;
  }
  if (failed) description = "Desktop downloads could not be loaded. Use the CLI instructions or browse releases.";
  const buttonLabel = selected ? `Download for ${selected.platform}` : "Use via CLI";

  return (
    <Box css={styles.download}>
      {loading ? (
        <Button variant="primary" size="lg" disabled aria-describedby="download-build">
          <Download />
          Checking downloads…
        </Button>
      ) : (
        <Button asChild variant="primary" size="lg">
          <a href={selected?.url ?? SITE_LINKS.installCli} aria-describedby="download-build">
            {selected ? <Download /> : <SquareTerminal />}
            {buttonLabel}
          </a>
        </Button>
      )}
      <HStack css={styles.downloadPlatforms}>
        <Text id="download-build" textStyle="label/S/regular" color="fg.muted" aria-live="polite">
          {description}
        </Text>
        {release && (
          <SearchableMenu
            searchPlaceholder="Find a build"
            emptyState="No builds available"
            showSearch={false}
            width="20rem"
            trigger={
              <Button variant="ghost" size="xs">
                Other platforms and CLI
                <ChevronDown />
              </Button>
            }
            items={[
              ...release.downloads.map((download) => ({
                id: download.id,
                label: `${download.platform} · ${download.architecture} · ${download.format.toUpperCase()}`,
                icon: platformIcon(download.platform),
                isSelected: download.id === selected?.id,
                onSelect: () => selectDownload(download.id),
              })),
              {
                id: "cli",
                label: "Use via CLI",
                icon: SquareTerminal,
                onSelect: () => window.location.assign(SITE_LINKS.installCli),
              },
            ]}
          />
        )}
        {failed && (
          <Button asChild variant="ghost" size="xs">
            <a href={DESKTOP_RELEASES_URL}>Browse releases</a>
          </Button>
        )}
      </HStack>
    </Box>
  );
};
