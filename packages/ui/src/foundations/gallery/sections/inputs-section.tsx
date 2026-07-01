import { HStack, Input, Stack, Textarea } from "@chakra-ui/react";
import { Checkbox } from "@/components/primitives/checkbox";
import { NumberInputField, NumberInputRoot } from "@/components/primitives/number-input";
import { Radio, RadioGroup } from "@/components/primitives/radio";
import { Slider } from "@/components/primitives/slider";
import { Switch } from "@/components/primitives/switch";
import { GalleryCard, GallerySection } from "../gallery-frame";

const inputSizes = ["2xs", "xs", "sm", "md", "lg"] as const;

export const InputsSection = () => {
  return (
    <GallerySection title="Inputs & form controls" description="Selection and value controls.">
      <GalleryCard title="Toggles" names={["Checkbox", "Switch"]}>
        <Checkbox defaultChecked>Enable project template</Checkbox>
        <Switch defaultChecked>Enable notifications</Switch>
      </GalleryCard>

      <GalleryCard title="Radio group" names={["RadioGroup", "Radio"]}>
        <RadioGroup defaultValue="typescript">
          <Stack gap="sm">
            <Radio value="typescript">TypeScript</Radio>
            <Radio value="python">Python</Radio>
            <Radio value="go">Go</Radio>
          </Stack>
        </RadioGroup>
      </GalleryCard>

      <GalleryCard title="Slider" names={["Slider"]}>
        <Slider min={0} max={100} defaultValue={[40]} width="100%" />
      </GalleryCard>

      <GalleryCard title="Text inputs" names={["Input", "Textarea"]}>
        <Stack gap="sm" width="100%">
          {inputSizes.map((size) => (
            <Input key={size} size={size} placeholder={`${size} input`} />
          ))}
          <Textarea placeholder="Notes" minHeight="80px" />
        </Stack>
      </GalleryCard>

      <GalleryCard title="Number input" names={["NumberInputRoot", "NumberInputField"]}>
        <HStack gap="sm" flexWrap="wrap" alignItems="center">
          {inputSizes.map((size) => (
            <NumberInputRoot key={size} min={0} max={100} step={1} defaultValue="50" size={size} width="120px">
              <NumberInputField />
            </NumberInputRoot>
          ))}
        </HStack>
      </GalleryCard>
    </GallerySection>
  );
};
