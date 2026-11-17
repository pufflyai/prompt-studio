import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { Slider } from "@pstdio/ui";
import { ParamEditor } from "@pstdio/ui/param-editor";
import { useState } from "react";
import { MarmaladePropertyInput } from "../../apps/marmalade/marmalade-property-input";

/** Shared primitives and delivered input, with synthetic property ownership only. */
export const PropertyControls = () => {
  const [accepted, setAccepted] = useState(80);
  const [draft, setDraft] = useState(accepted);
  const [mixed, setMixed] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [blend, setBlend] = useState("normal");
  const commit = (value: number) => {
    setAccepted(value);
    setDraft(value);
    setMixed(false);
  };
  const cancel = () => setDraft(accepted);
  return (
    <Stack p="md" gap="md" minW="0" bg="bg" color="fg">
      <HStack gap="xs" flexWrap="wrap" aria-label="Property exploration controls">
        <Button size="xs" variant="outline" onClick={() => setMixed(!mixed)}>
          {mixed ? "Select one layer" : "Select mixed layers"}
        </Button>
        <Button size="xs" variant="outline" onClick={() => setDisabled(!disabled)}>
          {disabled ? "Unlock selection" : "Lock selection"}
        </Button>
      </HStack>
      <Text textStyle="label/S/medium">Opacity {mixed ? "Mixed" : `${draft}%`}</Text>
      <MarmaladePropertyInput
        id="proposal-opacity"
        label="Opacity percent"
        type="number"
        value={mixed ? "" : accepted}
        min={0}
        max={100}
        disabled={disabled}
        onPreview={(value) => setDraft(Number(value))}
        onEdit={(value) => commit(Number(value))}
        onCancel={cancel}
      />
      <Slider
        aria-label={["Opacity"]}
        min={0}
        max={100}
        step={1}
        disabled={disabled}
        value={[draft]}
        onValueChange={({ value }) => setDraft(value[0])}
        onValueChangeEnd={({ value }) => commit(value[0])}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            cancel();
          }
        }}
      />
      <ParamEditor
        variant="small"
        fullWidth
        readOnly={disabled}
        params={[
          {
            id: "blend",
            name: "Blend mode",
            type: "selection",
            defaultValue: blend,
            options: [
              { id: "normal", name: "Normal" },
              ...Array.from({ length: 30 }, (_, index) => ({
                id: `blend-${index}`,
                name: `Extended blend option ${index + 1} with a long descriptive name`,
              })),
            ],
          },
        ]}
        onChange={(_id, value) => setBlend(String(value))}
      />
      <Box bg="bg.panel" p="md" opacity={draft / 100}>
        <Text textStyle="label/M/medium">The Great Wave</Text>
      </Box>
      <Button size="xs" variant="ghost" disabled={disabled} onClick={cancel}>
        Cancel preview
      </Button>
    </Stack>
  );
};
