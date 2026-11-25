import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { NumberInput, ParamEditor } from "@pstdio/ui/param-editor";
import { useState } from "react";

/** Shared primitives and delivered input, with synthetic property ownership only. */
export const MarmaladePropertyPreview = () => {
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
      {/* Shared numeric input previews immediately, commits once on blur/Enter or slider completion,
          and cancels on Escape. Authored input survives asynchronous acknowledgements. */}
      <NumberInput
        id="proposal-opacity"
        name="Opacity"
        description="Layer opacity"
        unit="%"
        defaultValue={accepted}
        mixed={mixed}
        min={0}
        max={100}
        disabled={disabled}
        onPreview={setDraft}
        onChange={(_id, value) => commit(value)}
        onCancel={cancel}
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
