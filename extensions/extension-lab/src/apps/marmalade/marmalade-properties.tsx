import { Button, chakra, HStack, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { ParamEditor } from "@pstdio/ui/param-editor";
import type {
  MarmaladeProperties as LayerProperties,
  MarmaladeAction,
  MarmaladeLayer,
  MarmaladeState,
} from "./marmalade.types";
import { defaultAdjustments, marmaladeLocked } from "./marmalade-layers";
import { MarmaladePropertyInput } from "./marmalade-property-input";
import { marmaladeStore } from "./marmalade-store";

interface FieldProps {
  label: string;
  value: string | number;
  numeric?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
  onEdit(value: string): void | Promise<void>;
}
const Field = (props: FieldProps) => {
  const { label, value, numeric, disabled, min, max, onEdit } = props;
  const id = `marmalade-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <Stack gap="2xs" minW="0">
      <chakra.label htmlFor={id} color="fg.muted" textStyle="label/XS">
        {label}
      </chakra.label>
      <MarmaladePropertyInput
        id={id}
        label={`Layer ${label === "X" || label === "Y" ? label : label.toLowerCase()}`}
        type={numeric ? "number" : "text"}
        value={value}
        disabled={disabled}
        min={min}
        max={max}
        onEdit={onEdit}
      />
    </Stack>
  );
};
export const MarmaladeProperties = (props: { state: MarmaladeState; layer: MarmaladeLayer }) => {
  const { state, layer } = props;
  const disabled = marmaladeLocked(state, layer);
  const dispatch = (action: MarmaladeAction) => marmaladeStore.dispatch(action);
  const property = (changes: Partial<LayerProperties>) => dispatch({ type: "properties", id: layer.id, changes });
  const number = (raw: string, change: (value: number) => void | Promise<void>) => {
    if (raw && Number.isFinite(Number(raw))) return change(Number(raw));
  };
  const adjustment = { ...defaultAdjustments, ...layer.adjustments };
  return (
    <Stack gap="sm" p="sm" borderBottomWidth="1px" borderColor="border.subtle">
      <Text textStyle="label/S/medium">Properties</Text>
      <Field
        label="Name"
        value={layer.name}
        disabled={disabled}
        onEdit={(name) => {
          if (name.trim()) return property({ name });
        }}
      />
      <SimpleGrid columns={2} gap="sm">
        {(["x", "y"] as const).map((axis) => (
          <Field
            key={axis}
            label={axis.toUpperCase()}
            value={layer[axis]}
            numeric
            disabled={disabled}
            onEdit={(raw) => number(raw, (value) => dispatch({ type: "position", id: layer.id, [axis]: value }))}
          />
        ))}
        {(["width", "height"] as const).map((key) => (
          <Field
            key={key}
            label={key === "width" ? "Width" : "Height"}
            value={layer[key]}
            numeric
            min={1}
            disabled={disabled || layer.kind === "group"}
            onEdit={(raw) =>
              number(raw, (value) => {
                if (value > 0) return property({ [key]: value });
              })
            }
          />
        ))}
        <Field
          label="Rotation"
          value={layer.rotation ?? 0}
          numeric
          min={-360}
          max={360}
          disabled={disabled || layer.kind === "group"}
          onEdit={(raw) => number(raw, (rotation) => property({ rotation }))}
        />
        <Field
          label="Opacity"
          value={Math.round(layer.opacity * 100)}
          numeric
          min={0}
          max={100}
          disabled={disabled}
          onEdit={(raw) => number(raw, (value) => dispatch({ type: "opacity", id: layer.id, opacity: value / 100 }))}
        />
      </SimpleGrid>
      {layer.kind === "text" ? (
        <>
          <Field
            label="Text"
            value={layer.text ?? ""}
            disabled={disabled}
            onEdit={(text) => dispatch({ type: "text", id: layer.id, text })}
          />
          <SimpleGrid columns={2} gap="sm">
            <Field
              label="Font size"
              value={layer.fontSize ?? layer.height * 0.8}
              numeric
              min={1}
              max={500}
              disabled={disabled}
              onEdit={(raw) =>
                number(raw, (fontSize) => {
                  if (fontSize > 0) return property({ fontSize });
                })
              }
            />
            <ParamEditor
              variant="small"
              fullWidth
              readOnly={disabled}
              params={[
                {
                  id: "fontWeight",
                  name: "Weight",
                  type: "selection",
                  defaultValue: layer.fontWeight ?? "400",
                  options: [
                    { id: "400", name: "Regular" },
                    { id: "700", name: "Bold" },
                  ],
                },
              ]}
              onChange={(_id, value) => property({ fontWeight: value as LayerProperties["fontWeight"] })}
            />
            <ParamEditor
              variant="small"
              fullWidth
              readOnly={disabled}
              params={[
                {
                  id: "fontFamily",
                  name: "Font",
                  type: "selection",
                  defaultValue: layer.fontFamily ?? "sans-serif",
                  options: [
                    { id: "sans-serif", name: "Sans serif" },
                    { id: "serif", name: "Serif" },
                    { id: "monospace", name: "Monospace" },
                  ],
                },
              ]}
              onChange={(_id, value) => property({ fontFamily: value as LayerProperties["fontFamily"] })}
            />
            <ParamEditor
              variant="small"
              fullWidth
              readOnly={disabled}
              params={[
                {
                  id: "align",
                  name: "Alignment",
                  type: "selection",
                  defaultValue: layer.align ?? "left",
                  options: [
                    { id: "left", name: "Left" },
                    { id: "center", name: "Center" },
                    { id: "right", name: "Right" },
                  ],
                },
              ]}
              onChange={(_id, value) => property({ align: value as LayerProperties["align"] })}
            />
          </SimpleGrid>
        </>
      ) : null}
      {layer.kind === "brush" ? (
        <Field
          label="Stroke width"
          value={layer.strokeWidth ?? 8}
          numeric
          disabled={disabled}
          min={1}
          max={100}
          onEdit={(raw) =>
            number(raw, (strokeWidth) => {
              if (strokeWidth > 0) return property({ strokeWidth });
            })
          }
        />
      ) : null}
      {layer.kind === "text" || layer.kind === "shape" || layer.kind === "brush" ? (
        <ParamEditor
          variant="small"
          fullWidth
          readOnly={disabled}
          params={[
            {
              id: "color",
              name: "Color",
              type: "color",
              defaultValue: layer.color ?? (layer.kind === "text" ? "#ffffff" : "#10263b"),
            },
          ]}
          onChange={(_id, value) => property({ color: String(value) })}
        />
      ) : null}
      {layer.kind === "image" ? (
        <>
          {(["brightness", "contrast", "saturation", "blur"] as const).map((key) => (
            <Field
              key={key}
              label={key[0].toUpperCase() + key.slice(1)}
              value={adjustment[key]}
              numeric
              min={0}
              max={key === "blur" ? 30 : 200}
              disabled={disabled}
              onEdit={(raw) =>
                number(raw, (value) => dispatch({ type: "adjustments", id: layer.id, changes: { [key]: value } }))
              }
            />
          ))}
          <HStack>
            <Button
              size="xs"
              variant="ghost"
              disabled={disabled}
              onClick={() => dispatch({ type: "adjustments", id: layer.id, changes: defaultAdjustments })}
            >
              Reset adjustments
            </Button>
          </HStack>
        </>
      ) : null}
    </Stack>
  );
};
