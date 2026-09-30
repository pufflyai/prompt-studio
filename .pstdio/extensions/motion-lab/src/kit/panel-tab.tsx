import { HStack, Text, useSlotRecipe } from "@chakra-ui/react";
import { FileText, MessageCircle, Plus, X } from "lucide-react";
export const PanelTab = (props: { title: string; chat?: boolean }) => {
  const { title, chat = false } = props;
  const styles = useSlotRecipe({ key: "tabs" })({ size: "sm" });
  return (
    <>
      <HStack css={[styles.root, styles.trigger]} data-selected="" gap="xs" minW="0">
        {chat ? <MessageCircle size={14} /> : <FileText size={14} />}
        <Text textStyle="label/S/regular" truncate>
          {title}
        </Text>
        <X size={12} />
      </HStack>
      <Plus size={14} />
    </>
  );
};
