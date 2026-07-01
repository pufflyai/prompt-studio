import { Box, Button, CloseButton, Dialog, HStack, Input, Separator, Stack, Text } from "@chakra-ui/react";
import { Download, Palette, RotateCcw, SlidersHorizontal } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { TokenValueEditor } from "@/components/internal/token-editor-controls";
import {
  createTokenEditorStyle,
  type TokenEditorPresetId,
  type TokenEditorToken,
  type TokenEditorValues,
  tokenEditorGroups,
  tokenEditorPresets,
} from "@/components/internal/token-editor-data";
import {
  exportTokenEditorOverrides,
  getDefaultTokenEditorPresetId,
  getDefaultTokenEditorValues,
} from "@/components/internal/token-editor-state";

type TokenEditorStyle = CSSProperties & Record<`--${string}`, string>;

export interface TokenPreviewScopeProps {
  values: TokenEditorValues;
  children: ReactNode;
}

export interface TokenEditorOverlayProps {
  basePresetId?: TokenEditorPresetId;
  baseValues?: TokenEditorValues;
  values: TokenEditorValues;
  onChange: (values: TokenEditorValues) => void;
}

const visibleGroups = (query: string) => {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return tokenEditorGroups;

  return tokenEditorGroups
    .map((group) => ({
      ...group,
      tokens: group.tokens.filter((token) => {
        const haystack = `${token.id} ${token.cssVariable} ${token.defaultValue}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      }),
    }))
    .filter((group) => group.tokens.length > 0);
};

const valueForToken = (token: TokenEditorToken, values: TokenEditorValues) => values[token.id] ?? token.defaultValue;

const TokenRow = (props: {
  token: TokenEditorToken;
  value: string;
  onValueChange: (tokenId: string, value: string) => void;
}) => {
  const { token, value, onValueChange } = props;

  return (
    <Box
      display="grid"
      gridTemplateColumns={{ base: "1fr", lg: "minmax(15rem, 1fr) minmax(18rem, 28rem)" }}
      gap="xs"
      alignItems="center"
      py="xs"
      borderBottomWidth="1px"
      borderColor="border.subtle"
    >
      <Stack gap="2xs" minW="0">
        <Text textStyle="label/S/medium" truncate>
          {token.id}
        </Text>
        <Text as="code" textStyle="label/XS" color="fg.muted" truncate>
          {token.cssVariable}
        </Text>
      </Stack>

      <TokenValueEditor token={token} value={value} onValueChange={onValueChange} />
    </Box>
  );
};

export const TokenPreviewScope = (props: TokenPreviewScopeProps) => {
  const { values, children } = props;
  const style = createTokenEditorStyle(values) as TokenEditorStyle;

  return (
    <Box minH="100vh" bg="bg" color="fg" style={style}>
      {children}
    </Box>
  );
};

export const TokenEditorOverlay = (props: TokenEditorOverlayProps) => {
  const { basePresetId, baseValues, values, onChange } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tokenRowsReady, setTokenRowsReady] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState(tokenEditorGroups[0]?.id ?? "");
  const resetPresetId = basePresetId ?? getDefaultTokenEditorPresetId();
  const resetValues = baseValues ?? getDefaultTokenEditorValues(resetPresetId);
  const [activePresetId, setActivePresetId] = useState<string>(resetPresetId);
  const groups = visibleGroups(query);
  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0];

  useEffect(() => {
    setActivePresetId(resetPresetId);
  }, [resetPresetId]);

  useEffect(() => {
    if (!open) {
      setTokenRowsReady(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => setTokenRowsReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const applyPreset = (presetValues: TokenEditorValues, presetId: string) => {
    onChange({ ...presetValues });
    setActivePresetId(presetId);
  };

  const updateTokenValue = (tokenId: string, value: string) => {
    onChange({ ...values, [tokenId]: value });
    setActivePresetId("custom");
  };

  return (
    <>
      <Box position="fixed" top="sm" right="sm" zIndex="overlay">
        <Button size="sm" variant="outline" bg="bg" onClick={() => setOpen(true)}>
          <SlidersHorizontal size={14} />
          Tokens
        </Button>
      </Box>

      <Dialog.Root lazyMount unmountOnExit open={open} onOpenChange={(details) => setOpen(details.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner p={{ base: "2xs", md: "sm" }}>
          <Dialog.Content width="min(98vw, 96rem)" height="min(94vh, 64rem)" maxW="none" maxH="94vh">
            <Dialog.Header px="md" py="sm" borderBottomWidth="1px" borderColor="border.subtle">
              <HStack gap="xs">
                <Palette size={16} />
                <Dialog.Title asChild>
                  <Text textStyle="label/L/medium">Token editor</Text>
                </Dialog.Title>
              </HStack>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body p="0" minH="0" display="flex">
              <Stack
                gap="sm"
                width={{ base: "11rem", md: "14rem" }}
                flexShrink="0"
                p="sm"
                borderRightWidth="1px"
                borderColor="border.subtle"
                bg="bg.subtle"
              >
                <Stack gap="2xs">
                  <Text textStyle="label/XS/medium" color="fg.muted">
                    Presets
                  </Text>
                  {tokenEditorPresets.map((preset) => (
                    <Button
                      key={preset.id}
                      size="xs"
                      variant={activePresetId === preset.id ? "subtle" : "ghost"}
                      justifyContent="flex-start"
                      onClick={() => applyPreset(preset.values, preset.id)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </Stack>

                <Separator />

                <Button
                  size="xs"
                  variant="outline"
                  justifyContent="flex-start"
                  onClick={() => applyPreset(resetValues, resetPresetId)}
                >
                  <RotateCcw size={14} />
                  Reset
                </Button>

                <Button
                  size="xs"
                  variant="outline"
                  justifyContent="flex-start"
                  onClick={() => exportTokenEditorOverrides(values, resetPresetId, resetValues)}
                >
                  <Download size={14} />
                  Export changes
                </Button>

                <Stack gap="2xs">
                  <Text textStyle="label/XS/medium" color="fg.muted">
                    Token groups
                  </Text>
                  {groups.map((group) => (
                    <Button
                      key={group.id}
                      size="xs"
                      variant={activeGroup?.id === group.id ? "subtle" : "ghost"}
                      justifyContent="space-between"
                      onClick={() => setActiveGroupId(group.id)}
                    >
                      <Text as="span" textStyle="label/XS" truncate>
                        {group.title}
                      </Text>
                      <Text as="span" textStyle="label/XS" color={activeGroup?.id === group.id ? "fg" : "fg.muted"}>
                        {group.tokens.length}
                      </Text>
                    </Button>
                  ))}
                </Stack>
              </Stack>

              <Stack gap="0" flex="1" minW="0" minH="0">
                <Box p="sm" borderBottomWidth="1px" borderColor="border.subtle">
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Filter tokens"
                    size="sm"
                  />
                </Box>

                <Box overflowY="auto" minH="0" p="sm">
                  {tokenRowsReady && activeGroup ? (
                    <Stack gap="xs">
                      <Stack gap="2xs">
                        <Text textStyle="label/L/medium">{activeGroup.title}</Text>
                        <Text textStyle="label/XS" color="fg.muted">
                          {activeGroup.description}
                        </Text>
                      </Stack>
                      <Stack gap="0">
                        {activeGroup.tokens.map((token) => (
                          <TokenRow
                            key={token.id}
                            token={token}
                            value={valueForToken(token, values)}
                            onValueChange={updateTokenValue}
                          />
                        ))}
                      </Stack>
                    </Stack>
                  ) : (
                    <Box height="8rem" />
                  )}
                </Box>
              </Stack>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  );
};
