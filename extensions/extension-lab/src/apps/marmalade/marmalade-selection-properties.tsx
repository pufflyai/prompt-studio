import { Stack, Text } from "@chakra-ui/react";
import { Slider } from "@pstdio/ui";
import { NumberInput, SelectionInput } from "@pstdio/ui/param-editor";
import { useEffect, useRef } from "react";
import type { MarmaladeAction, MarmaladeBlendMode, MarmaladeState } from "./marmalade.types";
import { marmaladeBlendModes } from "./marmalade-blend-modes";
import { marmaladeLocked } from "./marmalade-layers";
import { marmaladeStore } from "./marmalade-store";

interface OpacitySliderProps {
  value: number;
  disabled: boolean;
  onPreview(value: number): void | Promise<void>;
}

const MarmaladeOpacitySlider = ({ value, disabled, onPreview }: OpacitySliderProps) => {
  const gesture = useRef<"idle" | "previewing" | "cancelled">("idle");
  const cancel = () => {
    if (gesture.current === "previewing") void marmaladeStore.cancelPreview();
    gesture.current = "cancelled";
  };
  useEffect(
    () => () => {
      if (gesture.current === "previewing") void marmaladeStore.cancelPreview();
    },
    [],
  );
  return (
    <Slider
      aria-label={["Layer opacity (%)"]}
      mx="xs"
      min={0}
      max={100}
      step={1}
      value={[value]}
      disabled={disabled}
      onPointerDownCapture={() => {
        gesture.current = "idle";
      }}
      onPointerCancelCapture={cancel}
      onKeyDownCapture={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          cancel();
        } else if (gesture.current === "cancelled") gesture.current = "idle";
      }}
      onValueChange={({ value }) => {
        if (disabled || gesture.current === "cancelled") return;
        gesture.current = "previewing";
        void onPreview(value[0]);
      }}
      onValueChangeEnd={() => {
        if (gesture.current !== "previewing") return;
        gesture.current = "idle";
        void marmaladeStore.commitPreview();
      }}
    />
  );
};

export const MarmaladeSelectionProperties = ({ state }: { state: MarmaladeState }) => {
  const layers = state.document.layers.filter((layer) => state.selectedIds.includes(layer.id));
  const first = layers[0];
  if (!first) return null;
  const disabled = layers.some((layer) => marmaladeLocked(state, layer));
  // Keep fractional percentages without displaying floating-point multiplication noise.
  const opacity = Number((first.opacity * 100).toPrecision(15));
  const mixedOpacity = layers.some((layer) => layer.opacity !== first.opacity);
  const includesGroup = layers.some((layer) => layer.kind === "group");
  const blend = first.blendMode ?? "normal";
  const mixedBlend = layers.some((layer) => (layer.blendMode ?? "normal") !== blend);
  const blendPlaceholder = mixedBlend ? "Mixed" : "Choose blend mode";
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
      <Stack gap="xs">
        <NumberInput
          id="marmalade-selection-opacity"
          name="Layer opacity"
          description="Opacity of selected layers"
          unit="%"
          min={0}
          max={100}
          step={0}
          defaultValue={opacity}
          mixed={mixedOpacity}
          disabled={disabled}
          size="xs"
          fullWidth
          hideSlider
          onPreview={(value) => marmaladeStore.preview(action({ opacity: value / 100 }), "defocus")}
          onChange={() => marmaladeStore.commitPreview()}
          onCancel={() => marmaladeStore.cancelPreview()}
        />
        <MarmaladeOpacitySlider
          value={Math.round(opacity)}
          disabled={disabled}
          onPreview={(value) => marmaladeStore.preview(action({ opacity: value / 100 }))}
        />
      </Stack>
      <SelectionInput
        id="marmalade-blend-mode"
        name="Blend mode"
        description="How selected layers combine"
        defaultValue={includesGroup || mixedBlend ? "" : blend}
        placeholder={includesGroup ? "Individual layers only" : blendPlaceholder}
        readOnly={includesGroup}
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
