import { Field, Flex, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { ParamEditor } from "../param-editor";
import { NumberInputField, NumberInputRoot } from "../primitives/number-input";
import { editKeyframe, snapTime } from "./keyframe-model";
import type { AnimationKeyframe, KeyframeEasing, KeyframeTrack } from "./keyframe-timeline.types";

interface NumberFieldProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onCommit: (value: number) => void;
}
// Commit drafts synchronously on blur, so selection changes cannot leave delayed edits behind.
const KeyframeNumberField = (props: NumberFieldProps) => {
  const { label, value, onCommit } = props;
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const next = Number(draft);
    setDraft(String(value));
    if (draft.trim() && Number.isFinite(next) && next !== value) onCommit(next);
  };
  return (
    <Field.Root flex="1">
      <Field.Label>{label}</Field.Label>
      <NumberInputRoot
        value={draft}
        min={props.min}
        max={props.max}
        step={props.step}
        clampValueOnBlur={false}
        onValueChange={({ value }) => setDraft(value)}
      >
        <NumberInputField
          aria-label={label}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") setDraft(String(value));
          }}
        />
      </NumberInputRoot>
    </Field.Root>
  );
};
interface Props {
  track: KeyframeTrack;
  keyframe: AnimationKeyframe;
  duration: number;
  fps: number;
  onChange: (track: KeyframeTrack) => void;
}
export const KeyframeInspector = (props: Props) => {
  const { track, keyframe: key, duration, fps, onChange } = props;
  const [collision, setCollision] = useState<number | null>(null);
  useEffect(() => setCollision((time) => (time === key.time ? time : null)), [key.time]);
  return (
    <>
      <Flex p="sm" gap="sm" align="center" wrap="wrap">
        <KeyframeNumberField
          label="Keyframe time"
          value={key.time}
          min={0}
          max={duration}
          step={1 / fps}
          onCommit={(time) => {
            const next = editKeyframe(track, key.id, { time }, duration, fps);
            if (next === track && snapTime(time, duration, fps) !== key.time) {
              setCollision(key.time);
              return;
            }
            setCollision(null);
            onChange(next);
          }}
        />
        <KeyframeNumberField
          label="Keyframe value"
          value={key.value}
          onCommit={(value) => onChange(editKeyframe(track, key.id, { value }, duration, fps))}
        />
        <ParamEditor
          params={[
            {
              id: "easing",
              type: "selection",
              name: "Interpolation",
              defaultValue: key.easing ?? "linear",
              options: ["linear", "hold", "ease-in", "ease-out", "ease-in-out"].map((id) => ({ id, name: id })),
            },
          ]}
          onChange={(_id, value) =>
            onChange(editKeyframe(track, key.id, { easing: value as KeyframeEasing }, duration, fps))
          }
        />
      </Flex>
      {collision === key.time && (
        <Text role="alert" px="sm" color="fg.error">
          A keyframe already occupies that frame.
        </Text>
      )}
    </>
  );
};
