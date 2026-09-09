import { Box, Flex, HStack, IconButton, Menu, Portal, Text } from "@chakra-ui/react";
import { Breadcrumb, type BreadcrumbItem, ListRow } from "@pstdio/ui";
import { ChevronDown, Copy } from "lucide-react";
import { type LandingView, VIEW_META } from "../../content/landing-content";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { PromptStudioIcon } from "../icons/prompt-studio-icon";

interface WorkbenchNavProps {
  activeView: LandingView;
  resourceMarkdown?: string;
  onNavigate: (view: LandingView) => void;
  onOpenNavigation: () => void;
}

export const WorkbenchNav = (props: WorkbenchNavProps) => {
  const { activeView, resourceMarkdown, onNavigate, onOpenNavigation } = props;
  const viewMeta = VIEW_META[activeView];

  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: (
        <HStack gap="1.5" minWidth="0">
          <viewMeta.icon size={14} />
          <Text truncate>{viewMeta.label}</Text>
        </HStack>
      ),
    },
  ];

  const styles = useLandingStyles();

  return (
    <>
      <Box as="button" aria-label="Open navigation" css={styles.mobileNav} onClick={onOpenNavigation}>
        <viewMeta.icon size={14} />
        <Text fontFamily="heading" fontWeight="medium" textStyle="label/M/medium">
          {viewMeta.label}
        </Text>
      </Box>
      <Box css={styles.nav}>
        <HStack
          as="button"
          aria-label="Go to Prompt Studio home"
          height="7"
          px="1.5"
          gap="xs"
          rounded="xs"
          _hover={{ bg: "bg.hover" }}
          onClick={() => onNavigate("start")}
        >
          <Box width="4.5" height="4.5" flexShrink="0">
            <PromptStudioIcon />
          </Box>
          <Text fontFamily="heading" fontWeight="medium" textStyle="label/M/medium" whiteSpace="nowrap">
            Prompt Studio
          </Text>
        </HStack>

        <Text color="fg.subtle" textStyle="label/M/medium">
          /
        </Text>
        <Breadcrumb items={breadcrumbs} separator="/" separatorGap="6px" minWidth="0" textStyle="label/M/medium" />

        {resourceMarkdown && (
          <Menu.Root lazyMount closeOnSelect positioning={{ placement: "bottom-start" }}>
            <Menu.Trigger asChild>
              <IconButton aria-label="Page actions" variant="ghost" size="xs">
                <ChevronDown size={13} />
              </IconButton>
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content minW="14rem">
                  <Menu.Item value="copy-markdown" asChild>
                    <ListRow
                      variant="full-width"
                      icon={<Copy size={14} />}
                      label="Copy markdown"
                      onClick={() => navigator.clipboard.writeText(resourceMarkdown)}
                    />
                  </Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
        )}

        <Flex flex="1" />
      </Box>
    </>
  );
};
