import { HStack, IconButton, Popover, Text } from "@chakra-ui/react";
import { Info } from "lucide-react";

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
        <Popover.Root positioning={{ placement: "bottom-start", strategy: "fixed", hideWhenDetached: true }}>
          <Popover.Trigger asChild>
            <IconButton type="button" aria-label={`About ${name}`} variant="ghost" size="2xs">
              <Info />
            </IconButton>
          </Popover.Trigger>
          <Popover.Positioner>
            <Popover.Content aria-label={`About ${name}`}>
              <Popover.Body>{description}</Popover.Body>
            </Popover.Content>
          </Popover.Positioner>
        </Popover.Root>
      ) : null}
    </HStack>
  );
};
