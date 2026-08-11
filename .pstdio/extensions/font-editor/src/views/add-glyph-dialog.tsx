import { Button, Dialog, Field, HStack, Input, Text, VStack } from "@chakra-ui/react";
import type { WebviewFilesClient } from "@pstdio/sdk/extensions";
import { useState } from "react";

interface AddGlyphDialogProps {
  open: boolean;
  busy: boolean;
  files: WebviewFilesClient;
  onClose: () => void;
  onAdd: (input: { svg: string; name: string; codepoint?: string }) => Promise<void>;
}

export const AddGlyphDialog = (props: AddGlyphDialogProps) => {
  const { open, busy, files, onClose, onAdd } = props;
  const [file, setFile] = useState<File>();
  const [name, setName] = useState("");
  const [codepoint, setCodepoint] = useState("");

  const chooseFile = async () => {
    const [picked] = await files.pick({ accept: ".svg,image/svg+xml" });
    if (!picked) return;
    setFile(picked);
    setName(
      picked.name
        .replace(/\.svg$/i, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-"),
    );
  };

  const submit = async () => {
    if (!file || !name) return;
    await onAdd({ svg: await file.text(), name, codepoint: codepoint || undefined });
    setFile(undefined);
    setName("");
    setCodepoint("");
    onClose();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(details) => !details.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxWidth="lg">
          <Dialog.Header>
            <Dialog.Title>Add SVG glyph</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <VStack align="stretch" gap="md">
              <VStack align="stretch" gap="xs">
                <Button variant="outline" onClick={chooseFile}>
                  Choose SVG
                </Button>
                <Text textStyle="sm" color="fg.muted">
                  {file?.name ?? "No file selected"}
                </Text>
              </VStack>
              <Field.Root required>
                <Field.Label>Glyph name</Field.Label>
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="agent-spark" />
                <Field.HelperText>Lowercase letters, numbers, and hyphens.</Field.HelperText>
              </Field.Root>
              <Field.Root>
                <Field.Label>Codepoint</Field.Label>
                <Input
                  value={codepoint}
                  onChange={(event) => setCodepoint(event.target.value)}
                  placeholder="Next unused codepoint"
                />
              </Field.Root>
            </VStack>
          </Dialog.Body>
          <Dialog.Footer>
            <HStack>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={!file || !name} loading={busy} onClick={submit}>
                Add and build
              </Button>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
