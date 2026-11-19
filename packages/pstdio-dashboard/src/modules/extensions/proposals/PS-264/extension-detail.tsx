import { Button, Flex, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { ArrowLeft } from "lucide-react";
import { PageContentLayout } from "@/shared/components/page-content-layout";
import { ExtensionIcon } from "../../components/extension-icon";
import { ExtensionIdentity } from "../../components/extension-identity";
import { ExtensionToggle } from "../../components/extension-toggle";
import type { ExtensionPreview } from "./extension-fixtures";
import { ExtensionLabel, scopeLabels, visibilityLabels } from "./extension-labels";

interface ExtensionDetailProps {
  extension: ExtensionPreview;
  onBack: () => void;
  onToggle: (enabled: boolean) => void;
}

export const ExtensionDetail = (props: ExtensionDetailProps) => {
  const { extension, onBack, onToggle } = props;
  return (
    <PageContentLayout
      header={
        <Stack padding="lg" gap="md" borderBottomWidth="1px" borderColor="border.subtle">
          <Button variant="ghost" size="xs" alignSelf="start" onClick={onBack}>
            <Icon as={ArrowLeft} boxSize="3.5" />
            Extensions
          </Button>
          <HStack gap="md">
            <Flex
              align="center"
              justify="center"
              boxSize="11"
              borderWidth="1px"
              borderColor="border.subtle"
              borderRadius="xs"
              bg="bg.subtle"
              flexShrink="0"
            >
              <ExtensionIcon name={extension.icon} size="md" />
            </Flex>
            <Stack gap="2xs" flex="1" minW="0">
              <Text textStyle="heading/M">{extension.displayName}</Text>
              <ExtensionIdentity value={`${extension.extensionId} · v${extension.version}`} />
            </Stack>
            <ExtensionToggle name={extension.displayName} enabled={extension.enabled} onToggle={onToggle} />
          </HStack>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {extension.description}
          </Text>
          <HStack gap="sm">
            <ExtensionLabel extension={extension} kind="visibility" />
            <ExtensionLabel extension={extension} kind="scope" />
          </HStack>
        </Stack>
      }
    >
      <Stack padding="lg" gap="lg">
        <Text textStyle="label/S/medium">Installation</Text>
        <Stack gap="sm">
          <Text textStyle="label/XS/medium" color="fg.subtle">
            Visibility
          </Text>
          <ExtensionLabel extension={extension} kind="visibility" />
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {visibilityLabels[extension.visibility].description}
          </Text>
        </Stack>
        <Stack gap="sm">
          <Text textStyle="label/XS/medium" color="fg.subtle">
            Scope
          </Text>
          <ExtensionLabel extension={extension} kind="scope" />
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {scopeLabels[extension.scope].description}
          </Text>
          {extension.scope === "global" && extension.visibility === "private" && (
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              Other projects on this computer can use this extension while it stays private.
            </Text>
          )}
        </Stack>
        <Stack gap="sm">
          <Text textStyle="label/XS/medium" color="fg.subtle">
            Source path
          </Text>
          <ExtensionIdentity value={extension.sourcePath} />
        </Stack>
        <HStack justify="space-between" gap="md" borderTopWidth="1px" borderColor="border.subtle" paddingTop="md">
          <Text textStyle="label/S/regular">Enabled in this project</Text>
          <Text textStyle="label/S/regular" color="fg.muted" role="status">
            {extension.enabled ? "On" : "Off"}
          </Text>
        </HStack>
      </Stack>
    </PageContentLayout>
  );
};
