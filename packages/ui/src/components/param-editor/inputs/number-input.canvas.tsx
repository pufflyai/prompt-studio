import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { NumberInput } from "./number-input";

export default {
  title: "Design system/Patterns/Parameter editor/Number",
  description: "Explore a numeric property's previews, completion, cancellation and retained authored input.",
};

export const Editing = () => {
  const [accepted, setAccepted] = useState(80);
  const [preview, setPreview] = useState(80);
  const [edits, setEdits] = useState(0);
  const [open, setOpen] = useState(true);
  const [mixed, setMixed] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  return (
    <Stack p="md" gap="md" maxW="sm">
      <HStack flexWrap="wrap" gap="xs">
        <Button onClick={() => setOpen(!open)}>{open ? "Close control" : "Reopen control"}</Button>
        <Button onClick={() => setMixed(!mixed)}>{mixed ? "One value" : "Mixed selection"}</Button>
        <Button onClick={() => setDisabled(!disabled)}>{disabled ? "Enable control" : "Disable control"}</Button>
        <Button onClick={() => setReadOnly(!readOnly)}>{readOnly ? "Allow editing" : "Read only"}</Button>
      </HStack>
      {open && (
        <NumberInput
          id="opacity"
          name="Opacity"
          description="Layer opacity"
          unit="%"
          min={0}
          max={100}
          step={1}
          defaultValue={accepted}
          mixed={mixed}
          disabled={disabled}
          readOnly={readOnly}
          onPreview={setPreview}
          onChange={(_id, value) => {
            setAccepted(value);
            setPreview(value);
            setMixed(false);
            setEdits((count) => count + 1);
          }}
          onCancel={() => setPreview(accepted)}
        />
      )}
      <Text as="output" aria-label="Accepted opacity">
        {accepted}
      </Text>
      <Text as="output" aria-label="Preview opacity">
        {preview}
      </Text>
      <Text as="output" aria-label="Completed edits">
        {edits}
      </Text>
    </Stack>
  );
};
