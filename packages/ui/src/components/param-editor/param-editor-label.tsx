import { HStack, Icon, Text } from "@chakra-ui/react";
import { CircleHelp } from "lucide-react";
import { Tooltip } from "@/components/primitives/tooltip";

interface ParamEditorLabelProps {
  name: string;
  description?: string;
  compact?: boolean;
}

export const ParamEditorLabel = (props: ParamEditorLabelProps) => {
  const { name, description, compact = false } = props;

  return (
    <HStack gap="1" alignItems="center" minW="0">
      <Text
        textStyle={compact ? "label/XS/medium" : "label/S/medium"}
        color="fg.muted"
        letterSpacing={compact ? "0.08em" : undefined}
        textTransform={compact ? "uppercase" : undefined}
        truncate
      >
        {name}
      </Text>
      {description ? (
        <Tooltip content={description}>
          <Icon as={CircleHelp} boxSize="12px" color="fg.muted" opacity={0.6} cursor="help" flexShrink={0} />
        </Tooltip>
      ) : null}
    </HStack>
  );
};
