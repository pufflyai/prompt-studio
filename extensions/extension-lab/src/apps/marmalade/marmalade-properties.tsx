import { Button, chakra, HStack, SimpleGrid, Stack } from "@chakra-ui/react";
import { NumberInput, ParamEditor } from "@pstdio/ui/param-editor";
import type {
  MarmaladeProperties as LayerProperties,
  MarmaladeAction,
  MarmaladeLayer,
  MarmaladeState,
} from "./marmalade.types";
import { marmaladeLayerDimension } from "./marmalade-layer-properties";
import { defaultAdjustments, marmaladeLocked } from "./marmalade-layers";
import { MarmaladePropertyInput } from "./marmalade-property-input";
import { MarmaladeSelectionProperties } from "./marmalade-selection-properties";
import { marmaladeStore } from "./marmalade-store";

interface FieldProps {
  label: string;
  value: string | number;
  numeric?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
  required?: boolean;
  action(value: string): MarmaladeAction | undefined;
}
const Field = (props: FieldProps) => {
  const { label, value, numeric, disabled, min, max, required, action } = props;
  const id = `marmalade-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <Stack gap="2xs" minW="0">
      <chakra.label htmlFor={id} color="fg.muted" textStyle="label/XS">
        {label}
      </chakra.label>
      {numeric ? (
        <NumberInput
          id={id}
          name={`Layer ${label === "X" || label === "Y" ? label : label.toLowerCase()}`}
          description=""
          defaultValue={Number(value)}
          min={min}
          max={max}
          step={1}
          size="xs"
          hideLabel
          fullWidth
          hideSlider={label !== "Opacity"}
          disabled={disabled}
          onPreview={(next) => {
            const input = action(String(next));
            if (input) return marmaladeStore.preview(input, "defocus");
          }}
          onChange={() => marmaladeStore.commitPreview()}
          onCancel={() => marmaladeStore.cancelPreview()}
        />
      ) : (
        <MarmaladePropertyInput
          id={id}
          label={`Layer ${label === "X" || label === "Y" ? label : label.toLowerCase()}`}
          type={numeric ? "number" : "text"}
          value={value}
          disabled={disabled}
          min={min}
          max={max}
          required={required}
          onPreview={(value) => {
            const next = action(value);
            if (next) return marmaladeStore.preview(next, "defocus");
          }}
          onEdit={() => marmaladeStore.commitPreview()}
          onCancel={() => marmaladeStore.cancelPreview()}
        />
      )}
    </Stack>
  );
};
export const MarmaladeProperties = (props: { state: MarmaladeState; layer: MarmaladeLayer }) => {
  const { state, layer } = props;
  const disabled = marmaladeLocked(state, layer);
  const dispatch = (action: MarmaladeAction) => marmaladeStore.dispatch(action);
  const properties = (changes: Partial<LayerProperties>) => ({
    type: "properties" as const,
    id: layer.id,
    changes,
  });
  const property = (changes: Partial<LayerProperties>) => dispatch(properties(changes));
  const number = (raw: string, change: (value: number) => MarmaladeAction) =>
    raw && Number.isFinite(Number(raw)) ? change(Number(raw)) : undefined;
  const adjustment = { ...defaultAdjustments, ...layer.adjustments };
  return (
    <Stack gap="sm" p="sm" borderBottomWidth="1px" borderColor="border.subtle">
      <Field label="Name" value={layer.name} disabled={disabled} required action={(name) => properties({ name })} />
      <SimpleGrid columns={2} gap="sm">
        {(["x", "y"] as const).map((axis) => (
          <Field
            key={axis}
            label={axis.toUpperCase()}
            value={layer[axis]}
            numeric
            disabled={disabled}
            action={(raw) => number(raw, (value) => ({ type: "position", id: layer.id, [axis]: value }))}
          />
        ))}
        {(["width", "height"] as const).map((key) => (
          <Field
            key={key}
            label={key === "width" ? "Width" : "Height"}
            value={layer[key]}
            numeric
            {...marmaladeLayerDimension}
            disabled={disabled || layer.kind === "group"}
            action={(raw) => number(raw, (value) => properties({ [key]: value }))}
          />
        ))}
        <Field
          label="Rotation"
          value={layer.rotation ?? 0}
          numeric
          min={-360}
          max={360}
          disabled={disabled || layer.kind === "group"}
          action={(raw) => number(raw, (rotation) => properties({ rotation }))}
        />
      </SimpleGrid>
      <MarmaladeSelectionProperties state={state} />
      {layer.kind === "text" ? (
        <>
          <Field
            label="Text"
            value={layer.text ?? ""}
            disabled={disabled}
            action={(text) => ({ type: "text", id: layer.id, text })}
          />
          <SimpleGrid columns={2} gap="sm">
            <Field
              label="Font size"
              value={layer.fontSize ?? layer.height * 0.8}
              numeric
              min={1}
              max={500}
              disabled={disabled}
              action={(raw) => number(raw, (fontSize) => properties({ fontSize }))}
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
          action={(raw) => number(raw, (strokeWidth) => properties({ strokeWidth }))}
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
              action={(raw) =>
                number(raw, (value) => ({ type: "adjustments", id: layer.id, changes: { [key]: value } }))
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
