import { Button, HStack, Image, Popover, Portal, Text } from "@chakra-ui/react";
import { Braces, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/primitives/scroll-area";
import {
  buildJsonFields,
  FriendlyJsonDisplay,
  getJsonCellSummary,
  isJsonImageArray,
  isJsonImageValue,
} from "./friendly-json-display";

interface JsonCellProps {
  columnLabel: string;
  value: unknown;
}

const stopRowActivation = (event: { stopPropagation: () => void }) => event.stopPropagation();

export const JsonCell = (props: JsonCellProps) => {
  const { columnLabel, value } = props;
  const fields = buildJsonFields(value);
  const imageFields = fields
    .flatMap((field) => {
      if (isJsonImageValue(field.value, field.label)) return [field];
      if (!Array.isArray(field.value) || !isJsonImageArray(field.value, field.label)) return [];
      return field.value.map((image, index) => ({ label: `${field.label} ${index + 1}`, value: image }));
    })
    .slice(0, 2);
  const summary = getJsonCellSummary(value);

  return (
    <Popover.Root positioning={{ placement: "bottom-start", offset: { mainAxis: 6 } }}>
      <Popover.Trigger asChild>
        <Button
          aria-label={`View ${columnLabel} details`}
          variant="ghost"
          size="xs"
          width="full"
          minWidth="0"
          height="28px"
          paddingX="2xs"
          justifyContent="flex-start"
          onClick={stopRowActivation}
        >
          {imageFields.length > 0 ? (
            <HStack gap="-1" flexShrink="0">
              {imageFields.map((field) => (
                <Image
                  key={field.label}
                  src={String(field.value)}
                  alt={`${field.label} preview`}
                  boxSize="22px"
                  borderRadius="xs"
                  borderWidth="1px"
                  borderColor="border.subtle"
                  objectFit="cover"
                />
              ))}
            </HStack>
          ) : (
            <Braces size={14} />
          )}
          <Text flex="1" minWidth="0" textAlign="left" textStyle="paragraph/S/regular" truncate>
            {summary}
          </Text>
          <ChevronRight size={12} />
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content width="min(380px, calc(100vw - 32px))" padding="0" background="bg" overflow="hidden">
            <ScrollArea maxH="360px" viewportProps={{ overscrollBehavior: "contain" }}>
              <FriendlyJsonDisplay value={value} />
            </ScrollArea>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
