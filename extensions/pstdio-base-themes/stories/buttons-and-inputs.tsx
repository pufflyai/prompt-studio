import { Box, Button, Field, HStack, IconButton, Input, NumberInput, Stack, Text, Textarea } from "@chakra-ui/react";
import { Checkbox, Radio, RadioGroup, Slider, Switch } from "@pstdio/ui";
import { GallerySection } from "./gallery-section";

const variants = ["primary", "outline", "ghost", "subtle", "destructive"] as const;
const states = ["Default", "Hover", "Pressed", "Focus", "Disabled", "Loading"] as const;

export function Buttons() {
  return (
    <GallerySection title="Buttons and interaction states">
      <Text textStyle="label/S/regular" color="fg.muted">
        Each row: default, hover, pressed, keyboard focus, disabled, loading.
      </Text>
      {variants.map((variant) => (
        <Stack key={variant} gap="2xs">
          <Text textStyle="label/S/medium">{variant}</Text>
          <HStack gap="2xs" flexWrap="wrap">
            {states.map((state) => (
              <Button
                key={state}
                variant={variant}
                size="xs"
                data-hover={state === "Hover" ? "" : undefined}
                data-active={state === "Pressed" ? "" : undefined}
                data-focus-visible={state === "Focus" ? "" : undefined}
                disabled={state === "Disabled"}
                loading={state === "Loading"}
              >
                {state}
              </Button>
            ))}
          </HStack>
        </Stack>
      ))}
      <HStack gap="xs">
        <IconButton aria-label="Add item" variant="outline" size="xs">
          +
        </IconButton>
        <Button variant="ghost" aria-pressed="true" size="xs">
          Toggled
        </Button>
        {(["2xs", "xs", "sm", "md"] as const).map((size) => (
          <Button key={size} size={size}>
            {size}
          </Button>
        ))}
      </HStack>
    </GallerySection>
  );
}

export function Inputs() {
  return (
    <GallerySection title="Fields and selection controls">
      <Field.Root>
        <Field.Label>Name</Field.Label>
        <Input placeholder="Default input" aria-label="Default input" />
      </Field.Root>
      <Input placeholder="Hover" aria-label="Hovered input" data-hover="" />
      <Input placeholder="Keyboard focus" aria-label="Focused input" data-focus-visible="" />
      <Input placeholder="Disabled input" aria-label="Disabled input" disabled />
      <Field.Root invalid>
        <Field.Label>Invalid field</Field.Label>
        <Input defaultValue="Incomplete" />
        <Field.ErrorText>Enter a complete value.</Field.ErrorText>
      </Field.Root>
      <Textarea placeholder="Multiline notes" aria-label="Multiline notes" />
      <NumberInput.Root defaultValue="3" min={0} max={10} size="sm">
        <NumberInput.Input aria-label="Item count" />
        <NumberInput.Control>
          <NumberInput.IncrementTrigger />
          <NumberInput.DecrementTrigger />
        </NumberInput.Control>
      </NumberInput.Root>
      <HStack flexWrap="wrap">
        <Checkbox size="sm">Unchecked</Checkbox>
        <Checkbox size="sm" defaultChecked>
          Checked
        </Checkbox>
        <Checkbox size="sm" checked="indeterminate">
          Mixed
        </Checkbox>
        <Checkbox size="sm" disabled>
          Disabled
        </Checkbox>
      </HStack>
      <HStack>
        <Switch size="sm">Off</Switch>
        <Switch size="sm" defaultChecked>
          On
        </Switch>
        <Switch size="sm" disabled>
          Disabled
        </Switch>
      </HStack>
      <RadioGroup defaultValue="one" size="sm">
        <HStack>
          <Radio value="one">One</Radio>
          <Radio value="two">Two</Radio>
          <Radio value="three" disabled>
            Disabled
          </Radio>
        </HStack>
      </RadioGroup>
      <Box py="sm">
        <Slider aria-label={["Volume"]} defaultValue={[40]} />
      </Box>
    </GallerySection>
  );
}
