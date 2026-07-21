import { Badge, Button, CloseButton, Dialog, HStack, Link, Stack, Text, Timeline } from "@chakra-ui/react";
import { GitBranch } from "lucide-react";
import { CHANGELOG_ENTRIES, SITE_LINKS } from "./landing-content";

interface ChangelogModalProps {
  open: boolean;
  onClose: () => void;
}

export const ChangelogModal = (props: ChangelogModalProps) => {
  const { open, onClose } = props;

  return (
    <Dialog.Root open={open} onOpenChange={(details) => !details.open && onClose()} scrollBehavior="inside">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="34rem">
          <Dialog.Header>
            <HStack gap="2">
              <GitBranch size={16} />
              <Text textStyle="heading/M">Changelog</Text>
            </HStack>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body>
            <Timeline.Root size="sm" variant="subtle">
              {CHANGELOG_ENTRIES.map((entry, index) => (
                <Timeline.Item key={entry.version}>
                  <Timeline.Connector>
                    <Timeline.Separator />
                    <Timeline.Indicator />
                  </Timeline.Connector>
                  <Timeline.Content pb={index === CHANGELOG_ENTRIES.length - 1 ? "0" : "5"}>
                    <Timeline.Title>
                      <HStack gap="2">
                        <Badge size="sm" colorPalette={index === 0 ? "green" : "gray"} fontFamily="mono">
                          v{entry.version}
                        </Badge>
                        <Text fontFamily="mono" fontSize="xs" color="fg.subtle">
                          {entry.date}
                        </Text>
                        {index === 0 && (
                          <Badge size="sm" variant="outline">
                            latest
                          </Badge>
                        )}
                      </HStack>
                    </Timeline.Title>
                    <Stack gap="1" mt="1">
                      {entry.highlights.map((highlight) => (
                        <Text key={highlight} fontSize="sm" color="fg.muted" lineHeight="1.5">
                          {highlight}
                        </Text>
                      ))}
                    </Stack>
                  </Timeline.Content>
                </Timeline.Item>
              ))}
            </Timeline.Root>
          </Dialog.Body>
          <Dialog.Footer>
            <Button asChild variant="outline" size="sm">
              <Link href={SITE_LINKS.changelog} target="_blank" rel="noopener">
                Full changelog ↗
              </Link>
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
