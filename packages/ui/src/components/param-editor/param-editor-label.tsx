import { HStack, Icon, Text } from "@chakra-ui/react";
import { CircleHelp } from "lucide-react";
import { Tooltip } from "../tooltip";

interface ParamEditorLabelProps {
  name: string;
  description?: string;
}

export const ParamEditorLabel = (props: ParamEditorLabelProps) => {
  const { name, description } = props;

  return (
    <HStack gap="1" alignItems="center" minW="0">
      <Text textStyle="label/S/medium" color="fg.muted" truncate>
        {name}
      </Text>
      {description ? (
        <Tooltip content={description} showArrow>
          <Icon as={CircleHelp} boxSize="12px" color="fg.muted" opacity={0.6} cursor="help" flexShrink={0} />
        </Tooltip>
      ) : null}
    </HStack>
  );
};
