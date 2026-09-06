import { HStack, Text } from "@chakra-ui/react";
import { createExampleView, viewBackgrounds } from "../create-view";
import { createExampleStore } from "../example-store";
import { ExampleIcon } from "../icon";
import { exampleDefaults } from "../state-defaults";

const Status = () => (
  <HStack h="full" px="sm" gap="xs" justify="end">
    <ExampleIcon name="CloudCheck" size={12} />
    <Text textStyle="paragraph/XS/regular">Saved locally</Text>
  </HStack>
);
export default createExampleView(
  Status,
  createExampleStore("scribble", exampleDefaults.scribble),
  viewBackgrounds.status,
);
