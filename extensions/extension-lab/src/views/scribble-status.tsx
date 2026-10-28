import { HStack, Text } from "@chakra-ui/react";
import { createExampleView, viewBackgrounds } from "../create-view";
import { createExampleStore } from "../example-store";
import { ExampleIcon } from "../icon";
import { exampleDefaults } from "../state-defaults";
import type { ExampleViewInput } from "../view-context";

const Status = (props: { input: ExampleViewInput }) => (
  <HStack h="full" px="sm" gap="xs" justify="end">
    <ExampleIcon name="CloudCheck" size={12} />
    <Text textStyle="paragraph/XS/regular">
      {props.input.resource?.type === "scribble.draft" ? "Draft" : "Saved locally"}
    </Text>
  </HStack>
);
export default createExampleView(
  Status,
  createExampleStore("scribble", exampleDefaults.scribble),
  viewBackgrounds.status,
);
