import { CloseButton, Dialog, Portal } from "@chakra-ui/react";
import { useState } from "react";
import { autoBuildStoryConfiguration } from "./auto-build.story-fixture";
import { AutoBuildButton, type AutoBuildButtonProps } from "./auto-build-button";
import { AutoBuildDialogContent } from "./auto-build-dialog-content";

// Canvas owns a local dialog; production opens the same content with public host navigation.
export function AutoBuildDialogPreview(props: AutoBuildButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AutoBuildButton {...props} onOpen={() => setOpen(true)} />
      <Dialog.Root open={open} onOpenChange={({ open }) => setOpen(open)} size="xl">
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Auto Build</Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="sm" />
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body h="lg" p="0">
                <AutoBuildDialogContent
                  {...props}
                  configuration={autoBuildStoryConfiguration}
                  onClose={() => setOpen(false)}
                />
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
}
