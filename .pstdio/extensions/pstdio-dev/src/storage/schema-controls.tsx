import { createListCollection, Select, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { DatabaseSchema } from "../diagnostics/schema";

interface SchemaControlsProps {
  schema: DatabaseSchema;
  selectedId: string;
  onSelect: (id: string) => void;
}

export const SchemaControls = (props: SchemaControlsProps) => {
  const { schema, selectedId, onSelect } = props;
  const collection = createListCollection({
    items: [
      { label: "All tables", value: "" },
      ...schema.tables.map((table) => ({ label: table.id, value: table.id })),
    ],
  });
  return (
    <>
      <Select.Root
        collection={collection}
        value={[selectedId]}
        onValueChange={(event) => onSelect(event.value[0] ?? "")}
        size="sm"
        width="xs"
        maxW="full"
      >
        <Select.HiddenSelect />
        <Select.Control>
          <Select.Trigger aria-label="Choose table">
            <Select.ValueText placeholder="All tables" />
          </Select.Trigger>
          <Select.IndicatorGroup>
            <Select.Indicator />
          </Select.IndicatorGroup>
        </Select.Control>
        <Select.Positioner>
          <Select.Content>
            <ScrollArea maxH="xs">
              {collection.items.map((item) => (
                <Select.Item item={item} key={item.value}>
                  <Select.ItemText>{item.label}</Select.ItemText>
                  <Select.ItemIndicator />
                </Select.Item>
              ))}
            </ScrollArea>
          </Select.Content>
        </Select.Positioner>
      </Select.Root>
      <Text textStyle="label/XS" color="fg.muted" overflowWrap="anywhere">
        Defined schema · {schema.source} · may differ from the running database
      </Text>
    </>
  );
};
