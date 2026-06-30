import { Badge, Box, Button, HStack, Icon, IconButton, Input, Menu, Portal, Stack, Text } from "@chakra-ui/react";
import { ScrollArea, Switch } from "@pstdio/ui";
import type {
  AttributeDescriptor,
  AttributeKind,
  AttributeType,
  EnumOption,
  EnumOptions,
} from "@pstdio/ui/data-renderer";
import { isEnumOptionsSource } from "@pstdio/ui/data-renderer";
import { Circle, Plus, Trash2 } from "lucide-react";
import { useSyncExternalStore } from "react";
import { storySchemaStore } from "./mock-data";

const COLOR_PALETTE = ["gray", "red", "orange", "yellow", "green", "teal", "blue", "cyan", "purple", "pink"] as const;

const KIND_OPTIONS: { value: AttributeKind; label: string }[] = [
  { value: "enum", label: "Enum" },
  { value: "enum-multi", label: "Enum (multi)" },
  { value: "string", label: "String" },
  { value: "date", label: "Date" },
  { value: "number", label: "Number" },
  { value: "user", label: "User" },
];

const TOGGLE_FIELDS: { id: "filterable" | "groupable" | "sortable" | "displayable"; label: string }[] = [
  { id: "filterable", label: "Filterable" },
  { id: "groupable", label: "Groupable" },
  { id: "sortable", label: "Sortable" },
  { id: "displayable", label: "Displayable" },
];

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const ensureArrayOptions = (options: EnumOptions): EnumOption[] =>
  isEnumOptionsSource(options) ? options.getSnapshot() : options;

const ensureUniqueId = (base: string, taken: Set<string>) => {
  if (base && !taken.has(base)) return base;
  let counter = 2;
  const stem = base || "attribute";
  let candidate = `${stem}_${counter}`;
  while (taken.has(candidate)) {
    counter += 1;
    candidate = `${stem}_${counter}`;
  }
  return candidate;
};

const buildDefaultTypeForKind = (kind: AttributeKind): AttributeType => {
  if (kind === "enum" || kind === "enum-multi") {
    return { kind, options: [{ value: "option_1", label: "Option 1", color: "gray" }] };
  }
  return { kind };
};

interface ColorPickerProps {
  value: string | undefined;
  onChange: (color: string) => void;
}

const ColorPicker = (props: ColorPickerProps) => {
  const color = props.value ?? "gray";

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton aria-label="Pick color" variant="ghost" size="2xs">
          <Icon as={Circle} boxSize="14px" fill={`${color}.500`} color={`${color}.500`} />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="140px" bg="bg">
            {COLOR_PALETTE.map((entry) => (
              <Menu.Item key={entry} value={entry} onClick={() => props.onChange(entry)}>
                <HStack gap="xs">
                  <Icon as={Circle} boxSize="14px" fill={`${entry}.500`} color={`${entry}.500`} />
                  <Text textStyle="label/S/regular">{entry}</Text>
                </HStack>
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

interface KindMenuProps {
  value: AttributeKind;
  onChange: (kind: AttributeKind) => void;
}

const KindMenu = (props: KindMenuProps) => {
  const current = KIND_OPTIONS.find((option) => option.value === props.value);

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button size="xs" variant="outline">
          {current?.label ?? props.value}
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="180px" bg="bg">
            {KIND_OPTIONS.map((option) => (
              <Menu.Item key={option.value} value={option.value} onClick={() => props.onChange(option.value)}>
                <Text textStyle="label/S/regular">{option.label}</Text>
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

interface EnumOptionsEditorProps {
  options: EnumOptions;
  onChange: (next: EnumOption[]) => void;
}

const EnumOptionsEditor = (props: EnumOptionsEditorProps) => {
  const options = ensureArrayOptions(props.options);

  const update = (index: number, patch: Partial<EnumOption>) => {
    props.onChange(options.map((option, i) => (i === index ? { ...option, ...patch } : option)));
  };

  const remove = (index: number) => {
    props.onChange(options.filter((_, i) => i !== index));
  };

  const add = () => {
    const taken = new Set(options.map((option) => option.value));
    const value = ensureUniqueId(`option_${options.length + 1}`, taken);
    props.onChange([...options, { value, label: `Option ${options.length + 1}`, color: "gray" }]);
  };

  return (
    <Stack gap="2xs">
      <HStack justifyContent="space-between">
        <Text textStyle="label/XS/medium" color="fg.muted">
          Options
        </Text>
        <Button size="2xs" variant="ghost" onClick={add}>
          <Icon as={Plus} boxSize="12px" />
          Add option
        </Button>
      </HStack>
      {options.length === 0 ? (
        <Text textStyle="label/XS/regular" color="fg.muted">
          No options. Add one above.
        </Text>
      ) : null}
      {options.map((option, index) => (
        <HStack key={index} gap="2xs">
          <ColorPicker value={option.color} onChange={(color) => update(index, { color })} />
          <Input
            size="xs"
            placeholder="Label"
            value={option.label}
            onChange={(event) => update(index, { label: event.currentTarget.value })}
          />
          <Input
            size="xs"
            placeholder="value"
            value={option.value}
            onChange={(event) => update(index, { value: event.currentTarget.value })}
          />
          <IconButton aria-label="Remove option" variant="ghost" size="xs" onClick={() => remove(index)}>
            <Icon as={Trash2} boxSize="14px" />
          </IconButton>
        </HStack>
      ))}
    </Stack>
  );
};

interface AttributeRowProps {
  attribute: AttributeDescriptor;
  onChange: (next: AttributeDescriptor) => void;
  onRemove: () => void;
}

const AttributeRow = (props: AttributeRowProps) => {
  const { attribute, onChange, onRemove } = props;

  const setKind = (kind: AttributeKind) => {
    if (kind === attribute.type.kind) return;
    onChange({ ...attribute, type: buildDefaultTypeForKind(kind) });
  };

  const setOptions = (next: EnumOption[]) => {
    if (attribute.type.kind !== "enum" && attribute.type.kind !== "enum-multi") return;
    onChange({ ...attribute, type: { kind: attribute.type.kind, options: next } });
  };

  // Source-backed options aren't editable inline — surface that as a hint
  // instead of pretending the inputs would round-trip.
  const sourceBacked =
    (attribute.type.kind === "enum" || attribute.type.kind === "enum-multi") &&
    isEnumOptionsSource((attribute.type as Extract<AttributeType, { kind: "enum" | "enum-multi" }>).options);

  return (
    <Stack gap="xs" p="sm" borderWidth="1px" borderRadius="sm" bg="bg.subtle">
      <HStack gap="xs" align="center">
        <Input
          size="sm"
          placeholder="Label"
          value={attribute.label}
          onChange={(event) => onChange({ ...attribute, label: event.currentTarget.value })}
        />
        <Input
          size="sm"
          placeholder="id"
          value={attribute.id}
          onChange={(event) => onChange({ ...attribute, id: event.currentTarget.value })}
        />
        <KindMenu value={attribute.type.kind} onChange={setKind} />
        <IconButton aria-label="Remove attribute" variant="ghost" size="sm" onClick={onRemove}>
          <Icon as={Trash2} boxSize="14px" />
        </IconButton>
      </HStack>

      <HStack gap="md" flexWrap="wrap">
        {TOGGLE_FIELDS.map((field) => (
          <HStack key={field.id} gap="2xs">
            <Switch
              size="sm"
              checked={Boolean(attribute[field.id])}
              onCheckedChange={(details) => onChange({ ...attribute, [field.id]: details.checked })}
            />
            <Text textStyle="label/XS/regular" color="fg.muted">
              {field.label}
            </Text>
          </HStack>
        ))}
      </HStack>

      {attribute.type.kind === "enum" || attribute.type.kind === "enum-multi" ? (
        sourceBacked ? (
          <Badge variant="subtle" colorPalette="purple" alignSelf="flex-start">
            Options come from a live source
          </Badge>
        ) : (
          <EnumOptionsEditor
            options={(attribute.type as Extract<AttributeType, { kind: "enum" | "enum-multi" }>).options}
            onChange={setOptions}
          />
        )
      ) : null}
    </Stack>
  );
};

export const AttributeEditor = () => {
  const attributes = useSyncExternalStore(
    storySchemaStore.source.subscribe,
    storySchemaStore.source.getSnapshot,
    storySchemaStore.source.getSnapshot,
  );

  const replaceAt = (index: number, next: AttributeDescriptor) => {
    storySchemaStore.setAttributes(attributes.map((entry, i) => (i === index ? next : entry)));
  };

  const removeAt = (index: number) => {
    storySchemaStore.setAttributes(attributes.filter((_, i) => i !== index));
  };

  const addAttribute = () => {
    const taken = new Set(attributes.map((entry) => entry.id));
    const id = ensureUniqueId(`attribute_${attributes.length + 1}`, taken);
    const next: AttributeDescriptor = {
      id,
      label: `Attribute ${attributes.length + 1}`,
      type: buildDefaultTypeForKind("enum"),
      filterable: true,
      groupable: true,
      displayable: true,
    };
    storySchemaStore.setAttributes([...attributes, next]);
  };

  const reset = () => storySchemaStore.setAttributes([]);

  return (
    <ScrollArea maxH="80vh" contentProps={{ p: "md", display: "flex", flexDirection: "column", gap: "sm" }}>
      <HStack justifyContent="space-between">
        <Stack gap="0">
          <Text textStyle="heading/S/medium">Configure attributes</Text>
          <Text textStyle="label/XS/regular" color="fg.muted">
            Add, rename, change kinds, edit enum options. Everything is editable — including removing every attribute.
          </Text>
        </Stack>
        <HStack gap="2xs">
          <Button size="sm" variant="ghost" onClick={reset}>
            Clear all
          </Button>
          <Button size="sm" variant="outline" onClick={addAttribute}>
            <Icon as={Plus} boxSize="14px" />
            Add attribute
          </Button>
        </HStack>
      </HStack>
      {attributes.length === 0 ? (
        <Box borderWidth="1px" borderRadius="sm" p="md" textAlign="center">
          <Text textStyle="label/S/regular" color="fg.muted">
            No attributes defined. The renderer will fall back to title-only cards.
          </Text>
        </Box>
      ) : null}
      <Stack gap="sm">
        {attributes.map((attribute, index) => {
          const slug = slugify(attribute.label);
          const handleChange = (next: AttributeDescriptor) => {
            const proposed = { ...next };
            if (next.id === attribute.id && next.label !== attribute.label && slug && !proposed.id) {
              proposed.id = slug;
            }
            replaceAt(index, proposed);
          };
          return (
            <AttributeRow
              key={attribute.id || `attribute-${index}`}
              attribute={attribute}
              onChange={handleChange}
              onRemove={() => removeAt(index)}
            />
          );
        })}
      </Stack>
    </ScrollArea>
  );
};
