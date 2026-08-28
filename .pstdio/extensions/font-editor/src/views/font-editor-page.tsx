import { Badge, Box, Button, Flex, Grid, Heading, HStack, Input, Spinner, Text, VStack } from "@chakra-ui/react";
import type { GuestHost, WebviewFilesClient } from "@pstdio/sdk/extensions";
import { AlertMessage, EmptyState, ScrollArea } from "@pstdio/ui";
import { useEffect, useState } from "react";
import { AddGlyphDialog } from "./add-glyph-dialog";
import { executeFontCommand, loadFontEditor, showError } from "./font-editor-api";
import { GlyphCard } from "./glyph-card";
import { GlyphInspector } from "./glyph-inspector";
import { SettingsDialog } from "./settings-dialog";
import type { FontConfigView, FontInspectionView, FontOperationView, FontPreviewView, GlyphView } from "./types";

interface FontEditorPageProps {
  host: GuestHost;
  files: WebviewFilesClient;
}

export const FontEditorPage = (props: FontEditorPageProps) => {
  const { host, files } = props;
  const [inspection, setInspection] = useState<FontInspectionView>();
  const [preview, setPreview] = useState<FontPreviewView>();
  const [config, setConfig] = useState<FontConfigView>();
  const [selectedName, setSelectedName] = useState<string>();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const reload = async () => {
    const loaded = await loadFontEditor(host);
    setInspection(loaded.inspection);
    setPreview(loaded.preview);
    setConfig(loaded.config);
    return loaded;
  };

  useEffect(() => {
    let active = true;
    void loadFontEditor(host)
      .then((loaded) => {
        if (!active) return;
        setInspection(loaded.inspection);
        setPreview(loaded.preview);
        setConfig(loaded.config);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load the font.");
      });
    return () => {
      active = false;
    };
  }, [host]);

  const run = async <TResult,>(
    commandId: string,
    params: Record<string, unknown> | undefined,
    successMessage: (result: TResult) => string,
    nextSelection?: string | null,
  ) => {
    setBusy(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      const result = await executeFontCommand<TResult>(host, commandId, params);
      await reload();
      if (nextSelection === null) setSelectedName(undefined);
      else if (nextSelection) setSelectedName(nextSelection);
      setSuccess(successMessage(result));
      return result;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "The font operation failed.";
      setError(message);
      await showError(host, reason);
      throw reason;
    } finally {
      setBusy(false);
    }
  };

  if (!inspection || !preview || !config) {
    return (
      <Flex height="full" align="center" justify="center">
        {error ? <AlertMessage status="error">{error}</AlertMessage> : <Spinner />}
      </Flex>
    );
  }

  const selected = inspection.glyphs.find((glyph) => glyph.name === selectedName);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleGlyphs = inspection.glyphs.filter(
    (glyph) =>
      !normalizedQuery ||
      glyph.name.includes(normalizedQuery) ||
      glyph.codepoint.toLowerCase().includes(normalizedQuery),
  );
  const safeFamily = preview.family.replaceAll('"', "");

  return (
    <Flex direction="column" height="full" minHeight="0" background="bg.canvas">
      <style>{`@font-face { font-family: "${safeFamily}"; src: url("${preview.fontDataUrl}") format("truetype"); font-display: block; }`}</style>
      <Flex
        paddingX="lg"
        paddingY="md"
        gap="md"
        align={{ base: "stretch", lg: "center" }}
        direction={{ base: "column", lg: "row" }}
        borderBottomWidth="1px"
        borderColor="border.subtle"
        background="bg.panel"
      >
        <Box flex="1">
          <Heading size="lg">{inspection.family}</Heading>
          <HStack marginTop="2xs">
            <Badge variant="subtle">{inspection.glyphs.length} glyphs</Badge>
            <Text textStyle="xs" color="fg.muted">
              {inspection.unitsPerEm} units per em
            </Text>
          </HStack>
        </Box>
        <Input
          maxWidth={{ base: "full", lg: "22rem" }}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or codepoint"
          aria-label="Search glyphs"
        />
        <HStack>
          <Button
            variant="outline"
            loading={busy}
            onClick={() =>
              run<FontOperationView>(
                "font-editor.verify",
                undefined,
                (result) => `Verified ${result.glyphCount} glyphs across ${result.formats.length} font formats.`,
              )
            }
          >
            Verify
          </Button>
          <Button
            variant="outline"
            loading={busy}
            onClick={() =>
              run<FontOperationView>(
                "font-editor.build",
                undefined,
                (result) => `Built ${result.glyphCount} glyphs and regenerated every font and CSS output.`,
              )
            }
          >
            Build
          </Button>
          <Button variant="outline" onClick={() => setSettingsOpen(true)}>
            Settings
          </Button>
          <Button onClick={() => setAddOpen(true)}>Add SVG</Button>
        </HStack>
      </Flex>

      {error ? (
        <Box paddingX="lg" paddingTop="md">
          <AlertMessage status="error">{error}</AlertMessage>
        </Box>
      ) : null}
      {success ? (
        <Box paddingX="lg" paddingTop="md">
          <AlertMessage status="success">{success}</AlertMessage>
        </Box>
      ) : null}

      <Flex flex="1" minHeight="0" gap="lg" padding="lg">
        <ScrollArea flex="1">
          {visibleGlyphs.length ? (
            <Grid templateColumns="repeat(auto-fill, minmax(9rem, 1fr))" gap="sm" paddingRight="sm" alignItems="start">
              {visibleGlyphs.map((glyph) => (
                <GlyphCard
                  key={`${glyph.name}-${glyph.codepoint}`}
                  glyph={glyph}
                  family={preview.family}
                  selected={glyph.name === selectedName}
                  onSelect={(next) => setSelectedName(next.name)}
                />
              ))}
            </Grid>
          ) : (
            <EmptyState title="No matching glyphs" description="Try another name or Unicode codepoint." />
          )}
        </ScrollArea>
        <VStack width="20rem" align="stretch" gap="md">
          <GlyphInspector
            glyph={selected}
            family={preview.family}
            busy={busy}
            onRename={async (glyph: GlyphView, name: string) => {
              await run<FontOperationView>(
                "font-editor.glyph.rename",
                { glyph: glyph.name, name },
                () => `Renamed ${glyph.name} to ${name} and rebuilt every output.`,
                name,
              );
            }}
            onCodepoint={async (glyph: GlyphView, codepoint: string) => {
              await run<FontOperationView>(
                "font-editor.glyph.codepoint",
                { glyph: glyph.name, codepoint },
                () => `Moved ${glyph.name} to ${codepoint.toUpperCase()} and rebuilt every output.`,
                glyph.name,
              );
            }}
            onRemove={async (glyph: GlyphView) => {
              await run<FontOperationView>(
                "font-editor.glyph.remove",
                { glyph: glyph.name },
                (result) => `Removed ${glyph.name}. ${result.glyphCount} glyphs remain.`,
                null,
              );
            }}
          />
          <Box padding="md" borderWidth="1px" borderColor="border.subtle" borderRadius="md" background="bg.panel">
            <Text textStyle="xs" color="fg.muted">
              Canonical source
            </Text>
            <Text textStyle="sm" marginTop="2xs" wordBreak="break-all">
              {config.source}
            </Text>
          </Box>
        </VStack>
      </Flex>

      <AddGlyphDialog
        open={addOpen}
        busy={busy}
        files={files}
        onClose={() => setAddOpen(false)}
        onAdd={async (input) => {
          await run<FontOperationView>(
            "font-editor.glyph.add",
            input,
            () => `Added ${input.name} and rebuilt every output.`,
            input.name,
          );
        }}
      />
      <SettingsDialog
        open={settingsOpen}
        busy={busy}
        config={config}
        onClose={() => setSettingsOpen(false)}
        onSave={async (next) => {
          await run<FontConfigView>(
            "font-editor.config.set",
            {
              family: next.family,
              fileName: next.fileName,
              cssPrefix: next.cssPrefix,
              fontsUrl: next.fontsUrl,
              outputDir: next.outputDir,
              cssFile: next.cssFile,
              startCodepoint: next.startCodepoint,
              endCodepoint: next.endCodepoint,
            },
            () => "Saved font settings and rebuilt every output.",
          );
          setSettingsOpen(false);
        }}
      />
    </Flex>
  );
};
