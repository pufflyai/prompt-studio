import { Box, Button, chakra, Flex, HStack, Input } from "@chakra-ui/react";
import type { CommandExecuteRequest } from "@pstdio/sdk/api";
import { defaultThemePreferences, ThemePreferenceProvider, useThemePreference } from "@pstdio/ui";
import { useEffect, useState } from "react";
import { executeExtensionCommand, loadExtensionWorkbench } from "../lib/api";
import type { ExtensionBenchLoadResponse } from "../lib/api-contract";
import { type CommandCallLogEntry, recordCommandCallEntry } from "../lib/command-call-log";
import { CommandLog } from "./command-log";
import { MenuSelect } from "./menu-select";
import {
  type ExtensionHostCommandEvent,
  ExtensionWorkbenchPreview,
  extensionThemePreferences,
} from "./workbench-preview";

const defaultSourcePath = "./extensions/pstdio-planner";
const SourceLabel = chakra("label");

const extensionPresets = [
  { label: "Prompt Studio Planner", path: "./extensions/pstdio-planner" },
  { label: "Extension Lab", path: "./extensions/extension-lab" },
] as const;

const initialSourcePath = () => new URLSearchParams(window.location.search).get("source") ?? defaultSourcePath;

const selectedPresetPath = (sourcePath: string) =>
  extensionPresets.some((extensionPreset) => extensionPreset.path === sourcePath) ? sourcePath : "";

interface AppShellProps {
  bench: ExtensionBenchLoadResponse | null;
  error: string | null;
  loading: boolean;
  loadPreset: (sourcePath: string) => void;
  loadSource: () => void;
  selectedExtensionPreset: string;
  setSourceInput: (value: string) => void;
  sourceInput: string;
}

const AppShell = (props: AppShellProps) => {
  const { bench, error, loading, loadPreset, loadSource, selectedExtensionPreset, setSourceInput, sourceInput } = props;
  const { setThemePreference, themePreference } = useThemePreference();
  const [calls, setCalls] = useState<CommandCallLogEntry[]>([]);
  const [lastCommand, setLastCommand] = useState<ExtensionHostCommandEvent | null>(null);
  const [showCommandLog, setShowCommandLog] = useState(false);

  const recordCommandCall = (entry: CommandCallLogEntry) => {
    setCalls((current) => recordCommandCallEntry(current, entry));

    const response = entry.response;
    if (entry.status !== "success" || !response) return;
    setLastCommand((current) => ({
      commandId: entry.commandId,
      extensionId: response.extensionId,
      outcome: response.outcome,
      tick: (current?.tick ?? 0) + 1,
    }));
  };

  const executeCommand = (commandId: string, request: CommandExecuteRequest) => {
    if (!bench) throw new Error("Extension bench is not loaded.");
    return executeExtensionCommand({ benchId: bench.benchId, commandId, request });
  };

  return (
    <Box
      bg="bg"
      color="fg"
      data-theme-preference={themePreference}
      display="flex"
      flexDirection="column"
      h="100dvh"
      w="100dvw"
      minH="0"
      minW="0"
    >
      <Flex
        as="header"
        align={{ base: "stretch", lg: "center" }}
        bg="bg.panel"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        direction={{ base: "column", lg: "row" }}
        flexShrink="0"
        gap="3"
        minW="0"
        px="3"
        py="2"
      >
        <Box
          as="form"
          alignItems="center"
          display="grid"
          flex="1"
          gap="2"
          gridTemplateColumns={{
            base: "minmax(0, 1fr)",
            lg: "auto minmax(180px, 260px) minmax(220px, 560px) auto",
          }}
          minW="0"
          onSubmit={(event) => {
            event.preventDefault();
            loadSource();
          }}
        >
          <SourceLabel color="fg.muted" fontSize="sm" fontWeight="600" htmlFor="extension-preset">
            Extension
          </SourceLabel>
          <MenuSelect
            id="extension-preset"
            label="Extension"
            value={selectedExtensionPreset}
            placeholder="Custom path"
            options={extensionPresets.map((extensionPreset) => ({
              value: extensionPreset.path,
              label: extensionPreset.label,
            }))}
            minW="0"
            width="full"
            contentMinW="260px"
            onSelect={loadPreset}
          />
          <Input
            id="extension-source"
            aria-label="Extension source path"
            value={sourceInput}
            spellCheck={false}
            onChange={(event) => setSourceInput(event.currentTarget.value)}
          />
          <Button disabled={loading || sourceInput.trim().length === 0} type="submit">
            Load
          </Button>
        </Box>
        <HStack flexShrink="0" gap="2" minW="0">
          <Button onClick={() => setShowCommandLog((current) => !current)} size="sm" type="button" variant="outline">
            {showCommandLog ? "Hide commands" : `Show commands (${calls.length})`}
          </Button>
        </HStack>
      </Flex>
      {error ? (
        <Box
          bg="bg.error"
          borderBottomWidth="1px"
          borderColor="border.error"
          color="fg.error"
          flexShrink="0"
          fontSize="sm"
          px="3"
          py="2"
          role="alert"
        >
          {error}
        </Box>
      ) : null}
      <Box
        as="main"
        display="grid"
        flex="1"
        gridTemplateColumns={
          showCommandLog ? { base: "minmax(0, 1fr)", lg: "minmax(0, 1fr) minmax(260px, 320px)" } : "minmax(0, 1fr)"
        }
        gridTemplateRows={showCommandLog ? { base: "minmax(0, 1fr) 220px", lg: "minmax(0, 1fr)" } : "minmax(0, 1fr)"}
        minH="0"
        minW="0"
      >
        <Box as="section" aria-busy={loading} minH="0" minW="0" overflow="hidden">
          {bench ? (
            <ExtensionWorkbenchPreview
              key={bench.benchId}
              bench={bench}
              executeCommand={executeCommand}
              lastCommand={lastCommand}
              onCommandCall={recordCommandCall}
              setThemePreference={setThemePreference}
              themePreference={themePreference}
            />
          ) : (
            <Flex align="center" color="fg.muted" h="full" justify="center">
              {loading ? "Loading" : "No workbench"}
            </Flex>
          )}
        </Box>
        {showCommandLog ? <CommandLog calls={calls} /> : null}
      </Box>
    </Box>
  );
};

export const App = () => {
  const [sourceInput, setSourceInput] = useState(initialSourcePath);
  const [activeSourcePath, setActiveSourcePath] = useState(initialSourcePath);
  const [bench, setBench] = useState<ExtensionBenchLoadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    void loadExtensionWorkbench(activeSourcePath)
      .then((nextBench) => {
        if (cancelled) return;
        setBench(nextBench);
        const params = new URLSearchParams(window.location.search);
        params.set("source", activeSourcePath);
        window.history.replaceState(null, "", `?${params.toString()}`);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setBench(null);
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSourcePath]);

  const loadSource = () => setActiveSourcePath(sourceInput);

  const loadPreset = (sourcePath: string) => {
    if (!sourcePath) return;
    setSourceInput(sourcePath);
    setActiveSourcePath(sourcePath);
  };

  // Feed the loaded extension's themes into the provider so selecting one in the preview actually
  // resolves and applies its tokens instead of being rejected as an unknown preference.
  const themePreferences = bench
    ? [...defaultThemePreferences, ...extensionThemePreferences(bench)]
    : defaultThemePreferences;

  return (
    <ThemePreferenceProvider themePreferences={themePreferences}>
      <AppShell
        bench={bench}
        error={error}
        loading={loading}
        loadPreset={loadPreset}
        loadSource={loadSource}
        selectedExtensionPreset={selectedPresetPath(sourceInput)}
        setSourceInput={setSourceInput}
        sourceInput={sourceInput}
      />
    </ThemePreferenceProvider>
  );
};
