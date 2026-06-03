import { Button, HStack, Input, NativeSelect, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useLabHost } from "../hooks/host-context";
import { createLabView } from "../renderers/lab-view-shell";
import { readString } from "../utils/settings-values";

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

  return (
    <Stack gap="md" p="lg" maxW="md">
      <Stack gap="xs">
        <Text textStyle="label/S/medium">Greeting tone</Text>
        <NativeSelect.Root>
          <NativeSelect.Field value={tone} onChange={(event) => setTone(event.target.value)}>
            <option value="friendly">Friendly</option>
            <option value="formal">Formal</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
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
