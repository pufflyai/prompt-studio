import { Button, Dialog, Field, HStack, Input, SimpleGrid, VStack } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import type { FontConfigView } from "./types";

interface SettingsDialogProps {
  open: boolean;
  busy: boolean;
  config: FontConfigView;
  onClose: () => void;
  onSave: (config: FontConfigView) => Promise<void>;
}

const fields: { key: keyof FontConfigView; label: string }[] = [
  { key: "family", label: "Font family" },
  { key: "fileName", label: "File name" },
  { key: "cssPrefix", label: "CSS prefix" },
  { key: "fontsUrl", label: "Fonts URL" },
  { key: "outputDir", label: "Output directory" },
  { key: "cssFile", label: "CSS file" },
  { key: "startCodepoint", label: "Start codepoint" },
  { key: "endCodepoint", label: "End codepoint" },
];

export const SettingsDialog = (props: SettingsDialogProps) => {
  const { open, busy, config, onClose, onSave } = props;
  const [draft, setDraft] = useState(config);

  useEffect(() => setDraft(config), [config]);

  return (
    <Dialog.Root open={open} onOpenChange={(details) => !details.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxWidth="2xl">
          <Dialog.Header>
            <Dialog.Title>Font settings</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <VStack align="stretch" gap="md">
              <SimpleGrid columns={{ base: 1, md: 2 }} gap="md">
                {fields.map((field) => (
                  <Field.Root key={field.key}>
                    <Field.Label>{field.label}</Field.Label>
                    <Input
                      value={String(draft[field.key])}
                      onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                    />
                  </Field.Root>
                ))}
              </SimpleGrid>
              <Field.Root disabled>
                <Field.Label>Canonical TTF</Field.Label>
                <Input value={draft.source} readOnly />
              </Field.Root>
            </VStack>
          </Dialog.Body>
          <Dialog.Footer>
            <HStack>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button loading={busy} onClick={() => onSave(draft)}>
                Save and build
              </Button>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
