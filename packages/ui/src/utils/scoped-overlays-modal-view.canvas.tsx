import { Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { Activity, useState } from "react";
import { ScopedDialog as Dialog, ScopedPopover as Popover } from "./scoped-overlays";
import { Portal, UiScopeActivity, UiScopeProvider, UiScopeRoot } from "./ui-scope";

const ModalViews = () => {
  const [first, setFirst] = useState(true);
  const [nested, setNested] = useState(false);
  const [choice, setChoice] = useState("No nested choice");
  const [surfaceActive, setSurfaceActive] = useState(true);
  const [rootlessChoice, setRootlessChoice] = useState(false);
  return (
    <UiScopeProvider active>
      <UiScopeRoot>
        <Dialog.Root defaultOpen>
          <Portal>
            <Dialog.Backdrop />
            <Dialog.Positioner>
              <Dialog.Content>
                <Dialog.Header>
                  <Dialog.Title>Retained modal</Dialog.Title>
                </Dialog.Header>
                <Dialog.Body>
                  <Stack>
                    <HStack>
                      <Button onClick={() => setFirst(true)}>First view</Button>
                      <Button onClick={() => setFirst(false)}>Second view</Button>
                    </HStack>
                    <UiScopeActivity active={first}>
                      <Activity mode={first ? "visible" : "hidden"}>
                        <Stack align="start">
                          <Input aria-label="Modal draft" />
                          <Popover.Root>
                            <Popover.Trigger asChild>
                              <Button>Modal options</Button>
                            </Popover.Trigger>
                            <Portal>
                              <Popover.Positioner>
                                <Popover.Content aria-label="Modal options">
                                  <Popover.Body>
                                    <Button onClick={() => setFirst(false)}>Next view from options</Button>
                                  </Popover.Body>
                                </Popover.Content>
                              </Popover.Positioner>
                            </Portal>
                          </Popover.Root>
                          <Dialog.Root open={nested} onOpenChange={(details) => setNested(details.open)}>
                            <Dialog.Trigger asChild>
                              <Button>Open nested modal</Button>
                            </Dialog.Trigger>
                            <Portal>
                              <Dialog.Backdrop />
                              <Dialog.Positioner>
                                <Dialog.Content>
                                  <Dialog.Header>
                                    <Dialog.Title>Nested modal</Dialog.Title>
                                  </Dialog.Header>
                                  <Dialog.Body>
                                    <Popover.Root>
                                      <Popover.Trigger asChild>
                                        <Button>Nested options</Button>
                                      </Popover.Trigger>
                                      <Portal>
                                        <Popover.Positioner>
                                          <Popover.Content aria-label="Nested options">
                                            <Popover.Body>
                                              <Button onClick={() => setChoice("Nested choice kept")}>
                                                Keep nested choice
                                              </Button>
                                            </Popover.Body>
                                          </Popover.Content>
                                        </Popover.Positioner>
                                      </Portal>
                                    </Popover.Root>
                                    <Text>{choice}</Text>
                                    <Button onClick={() => setNested(false)}>Back to retained modal</Button>
                                  </Dialog.Body>
                                </Dialog.Content>
                              </Dialog.Positioner>
                            </Portal>
                          </Dialog.Root>
                        </Stack>
                      </Activity>
                    </UiScopeActivity>
                    {!first && <Text>Second modal view</Text>}
                    <UiScopeProvider active>
                      <Popover.Root>
                        <Popover.Trigger asChild>
                          <Button>Preference options</Button>
                        </Popover.Trigger>
                        <Portal>
                          <Popover.Positioner>
                            <Popover.Content aria-label="Preference options">
                              <Popover.Body>
                                <Button onClick={() => setRootlessChoice(true)}>Keep preference</Button>
                              </Popover.Body>
                            </Popover.Content>
                          </Popover.Positioner>
                        </Portal>
                      </Popover.Root>
                    </UiScopeProvider>
                    {rootlessChoice && <Text>Preference kept</Text>}
                    <Button onClick={() => setSurfaceActive(true)}>Restore nested surface</Button>
                    <UiScopeProvider active={surfaceActive}>
                      <UiScopeRoot>
                        <Activity mode={surfaceActive ? "visible" : "hidden"}>
                          <Stack align="start">
                            <Popover.Root>
                              <Popover.Trigger asChild>
                                <Button>Surface options</Button>
                              </Popover.Trigger>
                              <Portal>
                                <Popover.Positioner>
                                  <Popover.Content aria-label="Surface options">
                                    <Popover.Body>
                                      <Input aria-label="Surface popup draft" />
                                      <Button onClick={() => setSurfaceActive(false)}>Suspend nested surface</Button>
                                    </Popover.Body>
                                  </Popover.Content>
                                </Popover.Positioner>
                              </Portal>
                            </Popover.Root>
                          </Stack>
                        </Activity>
                      </UiScopeRoot>
                    </UiScopeProvider>
                  </Stack>
                </Dialog.Body>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>
      </UiScopeRoot>
    </UiScopeProvider>
  );
};

export default {
  title: "Design system/Components/Overlays/Retained modal views",
  component: ModalViews,
  description: "Views inside a modal own popup visibility; a deeper modal retains its own popup focus owner.",
} satisfies CanvasMeta<typeof ModalViews>;

export const RetainedView: CanvasFrame<typeof ModalViews> = {};
