import { Badge, Box, Button, Card, HStack, Icon, Stack } from "@chakra-ui/react";
import { Switch } from "@pstdio/ui";
import { Puzzle, Trash2 } from "lucide-react";
import type { ProjectExtensionInstance } from "pstdio-api-contracts";

interface ExtensionRowProps {
  extension: ProjectExtensionInstance;
  toggling: boolean;
  uninstalling: boolean;
  toggleAriaLabel: string;
  uninstallLabel: string;
  onToggle: (enabled: boolean) => void;
  onUninstall: () => void;
}

export const ExtensionRow = (props: ExtensionRowProps) => {
  const { extension, toggling, uninstalling, toggleAriaLabel, uninstallLabel, onToggle, onUninstall } = props;
  const description = extension.description ?? "No description provided.";

  return (
    <Card.Root size="sm" borderRadius="0" data-testid="extension-entry" opacity={extension.enabled ? 1 : 0.7}>
      <Card.Body>
        <HStack gap="4" alignItems="flex-start">
          <Icon boxSize="1em" fontSize="2xl" flexShrink="0" color="fg.muted">
            <Puzzle />
          </Icon>
          <Box flex="1" minW="0">
            <Stack gap="1">
              <HStack gap="2" flexWrap="wrap">
                <Card.Title textStyle="sm">{extension.displayName}</Card.Title>
                <Badge size="sm" variant="outline">
                  {extension.extensionId}
                </Badge>
                {extension.version && (
                  <Badge size="sm" variant="outline">
                    v{extension.version}
                  </Badge>
                )}
              </HStack>
              <Card.Description>{description}</Card.Description>
            </Stack>
          </Box>
          <HStack gap="2" flexShrink="0" alignItems="center">
            <Switch
              checked={extension.enabled}
              onCheckedChange={(details) => onToggle(details.checked)}
              disabled={toggling || uninstalling}
              aria-label={toggleAriaLabel}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              colorPalette="red"
              onClick={onUninstall}
              disabled={toggling || uninstalling}
              aria-label={uninstallLabel}
            >
              <Trash2 size={14} />
            </Button>
          </HStack>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
};
