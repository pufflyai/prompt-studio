import { HStack, Icon, Text } from "@chakra-ui/react";
import { Info } from "lucide-react";
import { Tooltip } from "../primitives/tooltip";

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
        <Tooltip
          content={description}
          portalled={false}
          positioning={{ placement: "bottom-start", strategy: "fixed", hideWhenDetached: true }}
        >
          <Icon
            asChild
            role="img"
            aria-label={`About ${name}`}
            aria-hidden={false}
            focusable="true"
            tabIndex={0}
            boxSize="3"
            color="fg.muted"
            flexShrink={0}
          >
            <Info />
          </Icon>
        </Tooltip>
      ) : null}
    </HStack>
  );
};
