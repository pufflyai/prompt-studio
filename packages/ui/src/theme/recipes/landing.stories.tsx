import { Box, Button, HStack, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ChevronDown, Download, SquareTerminal } from "lucide-react";
import { ResizableSplitLayout } from "@/components/layout/resizable-split-layout";
import { SearchableMenu } from "@/components/overlays/searchable-menu";
import { ScrollArea } from "@/components/primitives/scroll-area";

const LandingPanels = (props: { section?: string; desktopAvailable?: boolean }) => {
  const { section, desktopAvailable = true } = props;
  const recipe = useSlotRecipe({ key: "landing" });
  const styles = recipe({});
  return (
    <Box css={styles.root}>
      <Box css={styles.window}>
        <Box css={styles.titlebar}>
          <Text>Prompt Studio</Text>
        </Box>
        <Box css={styles.mobileTitlebar}>
          <Text>Prompt Studio</Text>
        </Box>
        <Box css={styles.body}>
          <ResizableSplitLayout
            width="full"
            height="full"
            resizableSide="left"
            defaultSizePx={480}
            minSizePx={360}
            contentMinSizePx={300}
            collapsible={false}
            resizeLabel="Resize download panel"
            resizablePanel={
              <Box css={styles.hero}>
                <ScrollArea height="full">
                  <Box css={styles.heroCopy}>
                    <Text as="h1" textStyle="heading/XL">
                      A workbench for your tools.
                    </Text>
                    <Text textStyle="paragraph/XL/regular" color="fg.muted">
                      Coding agents can build tools to help with your work. Prompt Studio gives them a place to live,
                      with the shared infrastructure they need to work together: search, CLI commands, editors, custom
                      UI, and more.
                    </Text>
                    <Box css={styles.download}>
                      <Button variant="primary" size="lg" width="full">
                        {desktopAvailable ? <Download /> : <SquareTerminal />}
                        {desktopAvailable ? "Download Prompt Studio" : "Use via CLI"}
                      </Button>
                      <Text textStyle="label/S/regular" color="fg.muted">
                        {desktopAvailable
                          ? "macOS · Apple silicon · DMG · v0.32.0"
                          : "The desktop app is not available on this platform yet."}
                      </Text>
                      <HStack gap="xs">
                        <SearchableMenu
                          showSearch={false}
                          searchPlaceholder="Find a build"
                          emptyState="No builds available"
                          trigger={
                            <Button variant="ghost" size="sm">
                              Other platforms
                              <ChevronDown />
                            </Button>
                          }
                          items={[
                            { id: "mac", label: "macOS · Apple silicon · DMG", isSelected: desktopAvailable },
                            { id: "linux", label: "Linux · x64 · DEB" },
                          ]}
                        />
                        {desktopAvailable && (
                          <Button asChild variant="ghost" size="sm">
                            <a href="https://github.com/pufflyai/prompt-studio/blob/main/README.md">
                              <SquareTerminal />
                              Use via CLI
                            </a>
                          </Button>
                        )}
                      </HStack>
                    </Box>
                  </Box>
                </ScrollArea>
              </Box>
            }
            contentPanel={
              <Box css={styles.tools}>
                {section && (
                  <ScrollArea height="full">
                    <Stack gap="xl" p="xl">
                      <Text as="h2" textStyle="heading/M">
                        {section}
                      </Text>
                      <Text textStyle="paragraph/M/regular" color="fg.muted">
                        Build custom tools with your agent and use them together in one app.
                      </Text>
                    </Stack>
                  </ScrollArea>
                )}
              </Box>
            }
          />
        </Box>
        <HStack as="footer" css={styles.status}>
          <Button size="xs" variant="ghost">
            Privacy
          </Button>
          <Button size="xs" variant="ghost">
            Terms
          </Button>
          <Text color="fg" textStyle="label/S/medium" ms="auto" flexShrink="0">
            © Pufflig AB. Stockholm, 2026
          </Text>
        </HStack>
      </Box>
    </Box>
  );
};

const meta = {
  title: "Theme/Landing Panels",
  component: LandingPanels,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof LandingPanels>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Desktop: Story = {};
export const DesktopUnavailable: Story = { args: { desktopAvailable: false } };
export const WhyPromptStudio: Story = { args: { section: "Extend Prompt Studio by combining building blocks." } };
export const Features: Story = { args: { section: "What will you build?" } };
