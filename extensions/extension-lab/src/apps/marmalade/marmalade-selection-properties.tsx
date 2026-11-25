import { Stack, Text } from "@chakra-ui/react";
import { NumberInput, SelectionInput } from "@pstdio/ui/param-editor";
import type { MarmaladeAction, MarmaladeBlendMode, MarmaladeState } from "./marmalade.types";
import { marmaladeBlendModes } from "./marmalade-blend-modes";
import { marmaladeLocked } from "./marmalade-layers";
import { marmaladeStore } from "./marmalade-store";

export const MarmaladeSelectionProperties = ({ state }: { state: MarmaladeState }) => {
  const layers = state.document.layers.filter((layer) => state.selectedIds.includes(layer.id));
  const first = layers[0];
  if (!first) return null;
  const disabled = layers.some((layer) => marmaladeLocked(state, layer));
  const mixedOpacity = layers.some((layer) => layer.opacity !== first.opacity);
  const blend = first.blendMode ?? "normal";
  const mixedBlend = layers.some((layer) => (layer.blendMode ?? "normal") !== blend);
  const action = (changes: Extract<MarmaladeAction, { type: "selection-properties" }>["changes"]) => ({
    type: "selection-properties" as const,
    ids: layers.map((layer) => layer.id),
    changes,
  });
  return (
    <Stack p="sm" gap="sm" minW="0" key={layers.map((layer) => layer.id).join(":")}>
      {layers.length > 1 && (
        <Text textStyle="label/XS" color="fg.muted">
          {layers.length} layers selected
        </Text>
      )}
      {disabled && (
        <Text textStyle="label/XS" color="fg.muted">
          Unlock the selection to edit its properties.
        </Text>
      )}
      <NumberInput
        id="marmalade-selection-opacity"
        name="Layer opacity"
        description="Opacity of selected layers"
        unit="%"
        min={0}
        max={100}
        step={1}
        defaultValue={Math.round(first.opacity * 100)}
        mixed={mixedOpacity}
        disabled={disabled}
        size="xs"
        fullWidth
        onPreview={(value, interaction) =>
          marmaladeStore.preview(action({ opacity: value / 100 }), interaction === "slider" ? "gesture" : "defocus")
        }
        onChange={() => marmaladeStore.commitPreview()}
        onCancel={() => marmaladeStore.cancelPreview()}
      />
      <SelectionInput
        id="marmalade-blend-mode"
        name="Blend mode"
        description="How selected layers combine"
        defaultValue={mixedBlend ? "" : blend}
        placeholder={mixedBlend ? "Mixed" : "Choose blend mode"}
        options={marmaladeBlendModes}
        disabled={disabled}
        searchable
        fullWidth
        size="xs"
        onChange={(_id, value) => {
          void marmaladeStore.dispatch(action({ blendMode: value as MarmaladeBlendMode }));
        }}
      />
    </Stack>
  );
};
