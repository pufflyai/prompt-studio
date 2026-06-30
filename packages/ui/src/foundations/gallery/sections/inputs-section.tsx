import { Stack } from "@chakra-ui/react";
import { Checkbox } from "@/components/checkbox";
import { NumberInputField, NumberInputRoot } from "@/components/number-input";
import { Radio, RadioGroup } from "@/components/radio";
import { Slider } from "@/components/slider";
import { Switch } from "@/components/switch";
import { GalleryCard, GallerySection } from "../gallery-frame";

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

      <GalleryCard title="Number input" names={["NumberInputRoot", "NumberInputField"]}>
        <NumberInputRoot min={0} max={100} step={1} defaultValue="50" width="120px">
          <NumberInputField />
        </NumberInputRoot>
      </GalleryCard>
    </GallerySection>
  );
};
