import { Box, Button, Dialog, Field, HStack, Input, Text, VStack } from "@chakra-ui/react";
import { SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useEffect, useState } from "react";
import type { GlyphView } from "./types";

interface GlyphInspectorProps {
  glyph?: GlyphView;
  family: string;
  busy: boolean;
  onRename: (glyph: GlyphView, name: string) => Promise<void>;
  onCodepoint: (glyph: GlyphView, codepoint: string) => Promise<void>;
  onRemove: (glyph: GlyphView) => Promise<void>;
}

export const GlyphInspector = (props: GlyphInspectorProps) => {
  const { glyph, family, busy, onRename, onCodepoint, onRemove } = props;
  const [name, setName] = useState("");
  const [codepoint, setCodepoint] = useState("");
  const [removeOpen, setRemoveOpen] = useState(false);

  useEffect(() => {
    setName(glyph?.name ?? "");
    setCodepoint(glyph?.codepoint ?? "");
    setRemoveOpen(false);
  }, [glyph]);

  if (!glyph) {
    return (
      <SimpleCard>
        <SimpleCardBody>
          <Text textStyle="sm" color="fg.muted">
            Select a glyph to rename it, move its codepoint, or remove it.
          </Text>
        </SimpleCardBody>
      </SimpleCard>
    );
  }

  return (
    <SimpleCard>
      <SimpleCardBody>
        <VStack align="stretch" gap="md">
          <VStack gap="xs">
            <Box fontFamily={family} fontSize="6xl" lineHeight="1">
              {String.fromCodePoint(glyph.unicode)}
            </Box>
            <Text textStyle="xs" color="fg.muted">
              Advance width {glyph.advanceWidth}
            </Text>
          </VStack>
          <Field.Root>
            <Field.Label>Name</Field.Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
            <Button
              width="full"
              variant="outline"
              loading={busy}
              disabled={name === glyph.name}
              onClick={() => onRename(glyph, name)}
            >
              Rename and build
            </Button>
          </Field.Root>
          <Field.Root>
            <Field.Label>Codepoint</Field.Label>
            <Input value={codepoint} onChange={(event) => setCodepoint(event.target.value)} />
            <Button
              width="full"
              variant="outline"
              loading={busy}
              disabled={codepoint.toUpperCase() === glyph.codepoint}
              onClick={() => onCodepoint(glyph, codepoint)}
            >
              Move and build
            </Button>
          </Field.Root>
          <HStack justify="end">
            <Button colorPalette="red" variant="outline" loading={busy} onClick={() => setRemoveOpen(true)}>
              Remove glyph
            </Button>
          </HStack>
        </VStack>
      </SimpleCardBody>
      <Dialog.Root open={removeOpen} onOpenChange={(details) => setRemoveOpen(details.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxWidth="sm">
            <Dialog.Header>
              <Dialog.Title>Remove {glyph.name}?</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>This removes the glyph and rebuilds every generated font and CSS file.</Text>
            </Dialog.Body>
            <Dialog.Footer>
              <HStack>
                <Button variant="ghost" disabled={busy} onClick={() => setRemoveOpen(false)}>
                  Cancel
                </Button>
                <Button
                  colorPalette="red"
                  loading={busy}
                  onClick={async () => {
                    await onRemove(glyph);
                    setRemoveOpen(false);
                  }}
                >
                  Remove and build
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </SimpleCard>
  );
};
