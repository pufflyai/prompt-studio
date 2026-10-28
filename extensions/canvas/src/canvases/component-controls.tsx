import { Field, Flex, Input, NumberInput, Stack, Text, Textarea } from "@chakra-ui/react";
import { Checkbox, Radio, RadioGroup, SegmentedControl, Slider, Switch } from "@pstdio/ui";
import { useState } from "react";
import { Button } from "../components/themed-primitives";

export const ButtonStates = () => (
  <Stack p="md" gap="lg">
    <Text textStyle="heading/M">Buttons &amp; actions</Text>
    {(["primary", "outline", "ghost", "destructive", "destructive-ghost", "subtle"] as const).map((variant) => (
      <Stack key={variant} gap="xs">
        <Text textStyle="mono/XS">{variant}</Text>
        <Flex gap="sm" wrap="wrap">
          <Button variant={variant}>Button</Button>
          <Button variant={variant} disabled>
            Disabled
          </Button>
          <Button variant={variant} loading>
            Loading
          </Button>
        </Flex>
      </Stack>
    ))}
    <Flex gap="xs" align="center" wrap="wrap">
      {(["2xs", "xs", "sm", "md", "lg", "2xl"] as const).map((size) => (
        <Button key={size} size={size}>
          {size}
        </Button>
      ))}
    </Flex>
  </Stack>
);

export const FieldStates = () => (
  <Stack p="md" gap="md">
    <Text textStyle="heading/M">Inputs</Text>
    <Field.Root>
      <Field.Label>Project name</Field.Label>
      <Input size="sm" defaultValue="Prompt Studio" />
    </Field.Root>
    <Field.Root invalid>
      <Field.Label>Required field</Field.Label>
      <Input size="sm" placeholder="Add a value" />
      <Field.ErrorText>Enter a value to continue.</Field.ErrorText>
    </Field.Root>
    <Input size="sm" readOnly value="Read-only" aria-label="Read-only input" />
    <Input size="sm" disabled value="Disabled" aria-label="Disabled input" />
    <Field.Root>
      <Field.Label>Description</Field.Label>
      <Textarea size="sm" defaultValue="Build tools through conversation." />
    </Field.Root>
    <Field.Root>
      <Field.Label>Count</Field.Label>
      <NumberInput.Root size="sm" defaultValue="50" min={0} max={100}>
        <NumberInput.Input aria-label="Count" />
        <NumberInput.Control>
          <NumberInput.IncrementTrigger />
          <NumberInput.DecrementTrigger />
        </NumberInput.Control>
      </NumberInput.Root>
    </Field.Root>
  </Stack>
);

export const SelectionStates = () => {
  const [tab, setTab] = useState("board");
  const [value, setValue] = useState([40]);
  return (
    <Stack p="md" gap="md">
      <Text textStyle="heading/M">Selection controls</Text>
      <Checkbox defaultChecked>Enable notifications</Checkbox>
      <Checkbox>Unchecked</Checkbox>
      <Checkbox checked="indeterminate">Mixed selection</Checkbox>
      <Checkbox disabled>Disabled checkbox</Checkbox>
      <Switch defaultChecked>Enabled switch</Switch>
      <Switch>Off switch</Switch>
      <Switch disabled>Disabled switch</Switch>
      <RadioGroup defaultValue="first" aria-label="Example radio group">
        <Flex gap="md">
          <Radio value="first">First</Radio>
          <Radio value="second">Second</Radio>
          <Radio value="third" disabled>
            Disabled
          </Radio>
        </Flex>
      </RadioGroup>
      <SegmentedControl
        aria-label="View"
        options={[
          { value: "board", label: "Board" },
          { value: "list", label: "List" },
          { value: "table", label: "Table" },
        ]}
        value={tab}
        onValueChange={setTab}
      />
      <Text textStyle="label/S/medium">Slider · {value[0]}</Text>
      <Slider aria-label={["Example value"]} value={value} onValueChange={(details) => setValue(details.value)} />
    </Stack>
  );
};
