import { HStack, Text } from "@chakra-ui/react";
import { GitBranch } from "lucide-react";

interface WorkbenchStatusBarProps {
  label: string;
  onOpenChangelog: () => void;
}

export const WorkbenchStatusBar = (props: WorkbenchStatusBarProps) => {
  const { label, onOpenChangelog } = props;

  return (
    <HStack
      as="footer"
      aria-label="Workbench status"
      height="28px"
      flexShrink="0"
      gap="14px"
      px="12px"
      bg="bg.subtle"
      borderTopWidth="1px"
      borderColor="border"
      color="fg.muted"
      display={{ base: "none", md: "flex" }}
    >
      <HStack as="button" gap="8px" fontFamily="mono" fontSize="9px" onClick={onOpenChangelog}>
        <GitBranch size={10} />
        <Text>{label}</Text>
      </HStack>
      <Text flex="1" textAlign="right" fontFamily="body" fontSize="9px" color="fg.subtle">
        © {new Date().getFullYear()} Prompt Studio. All rights reserved.
      </Text>
    </HStack>
  );
};
