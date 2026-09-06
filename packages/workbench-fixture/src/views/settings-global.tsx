import { Button, HStack, Input, Menu, Portal, Stack, Text } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import { useEffect, useState } from "react";
import { useLabHost } from "../hooks/host-context";
import { createLabView } from "../renderers/lab-view-shell";
import { readString } from "../utils/settings-values";

const toneOptions = [
  { value: "friendly", label: "Friendly" },
  { value: "formal", label: "Formal" },
] as const;

const GlobalSettings = () => {
  const { host } = useLabHost();
  const [tone, setTone] = useState("friendly");
  const [model, setModel] = useState("claude-sonnet-4");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const values = (await host.call("extension.settings.all", {})) as Record<string, unknown>;
      if (cancelled) return;
      setTone(readString(values["greeting.tone"], "friendly"));
      setModel(readString(values["model.default"], "claude-sonnet-4"));
    })();
    return () => {
      cancelled = true;
    };
  }, [host]);

  const save = async () => {
    await host.call("extension.settings.set", { key: "greeting.tone", value: tone });
    await host.call("extension.settings.set", { key: "model.default", value: model });
    setStatus("Saved");
  };

  const selectedToneLabel = toneOptions.find((option) => option.value === tone)?.label ?? "Friendly";

  return (
    <Stack gap="md" p="lg" maxW="md">
      <Stack gap="xs">
        <Text textStyle="label/S/medium">Greeting tone</Text>
        <Menu.Root>
          <Menu.Trigger asChild>
            <Button type="button" variant="outline" width="full" justifyContent="flex-start">
              {selectedToneLabel}
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content minW="240px" bg="bg">
                {toneOptions.map((option) => (
                  <Menu.Item key={option.value} value={option.value} asChild>
                    <ListRow
                      asChild
                      variant="compact"
                      id={option.value}
                      label={option.label}
                      isSelected={option.value === tone}
                      onActivate={() => setTone(option.value)}
                    />
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </Stack>
      <Stack gap="xs">
        <Text textStyle="label/S/medium">Default model</Text>
        <Input value={model} onChange={(event) => setModel(event.target.value)} />
      </Stack>
      <HStack gap="sm">
        <Button type="button" size="sm" onClick={save}>
          Save
        </Button>
        {status ? (
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {status}
          </Text>
        ) : null}
      </HStack>
    </Stack>
  );
};

export default createLabView(() => <GlobalSettings />);
