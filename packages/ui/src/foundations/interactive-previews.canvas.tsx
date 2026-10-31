import { Box, Button, Dialog, Field, Flex, Input, Link, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { Checkbox, ScrollArea, Switch } from "@/components/primitives";

// This is the component viewport being demonstrated, not the surrounding documentation panel.
const controlsScrollViewportHeight = 180;

export default { title: "Design System/Interactive previews" };

export const ProjectForm = () => {
  const [name, setName] = useState("My workspace");
  const [submitted, setSubmitted] = useState(false);
  return (
    <Stack p="md" gap="md" h="full">
      <Text textStyle="heading/S">Create a project</Text>
      <Field.Root>
        <Field.Label>Project name</Field.Label>
        <Input
          size="sm"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setSubmitted(false);
          }}
        />
      </Field.Root>
      <Checkbox defaultChecked>Open when ready</Checkbox>
      <Flex gap="sm">
        <Button variant="primary" onClick={() => setSubmitted(true)}>
          Create project
        </Button>
        <Button disabled>Connect account</Button>
      </Flex>
      {submitted && (
        <Text role="status" textStyle="paragraph/S/regular">
          Preview created: {name}
        </Text>
      )}
      <Link href="#canvas-item=controls">Explore shared controls</Link>
    </Stack>
  );
};
export const Controls = () => (
  <Stack p="md" gap="md" h="full" minH="0">
    <Text textStyle="heading/S">Shared controls</Text>
    <Switch defaultChecked>Live preview</Switch>
    <Input size="sm" readOnly value="Read-only example" aria-label="Read-only example" />
    <Flex gap="sm">
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button>Open popover</Button>
        </Popover.Trigger>
        <Portal>
          <Popover.Positioner>
            <Popover.Content>
              <Popover.Body>
                <Stack gap="sm">
                  <Text>Native portal</Text>
                  <Input size="sm" placeholder="Popover draft" />
                  <Link href="#canvas-item=project-form">Project form</Link>
                </Stack>
              </Popover.Body>
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      </Popover.Root>
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <Button>Open dialog</Button>
        </Dialog.Trigger>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Preview dialog</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Input size="sm" placeholder="Dialog draft" />
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.ActionTrigger asChild>
                  <Button>Close</Button>
                </Dialog.ActionTrigger>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Flex>
    <Box flex="1" minH="0" borderWidth="1px" borderColor="border.subtle" borderRadius="xs">
      <ScrollArea h={`${controlsScrollViewportHeight}px`}>
        <Stack p="sm" gap="sm">
          {Array.from({ length: 15 }, (_, index) => (
            <Text key={index} textStyle="paragraph/S/regular">
              Sample row {index + 1}
            </Text>
          ))}
        </Stack>
      </ScrollArea>
    </Box>
  </Stack>
);
