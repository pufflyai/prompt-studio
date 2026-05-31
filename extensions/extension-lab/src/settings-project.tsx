import { Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { Switch } from "@pstdio/ui";
import { useEffect, useState } from "react";
import { useLabHost } from "./host-context";
import { createLabView } from "./lab-view-shell";

const readNumber = (value: unknown, fallback: number) => (typeof value === "number" ? value : fallback);
const readBoolean = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);

const ProjectSettings = () => {
  const { host } = useLabHost();
  const [step, setStep] = useState(1);
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const values = (await host.call("extension.settings.all", {})) as Record<string, unknown>;
      if (cancelled) return;
      setStep(readNumber(values["counter.step"], 1));
      setEnabled(readBoolean(values["counter.enabled"], true));
    })();
    return () => {
      cancelled = true;
    };
  }, [host]);

  const save = async () => {
    await host.call("extension.settings.set", { key: "counter.step", value: step });
    await host.call("extension.settings.set", { key: "counter.enabled", value: enabled });
    setStatus("Saved");
  };

  return (
    <Stack gap="md" p="lg" maxW="md">
      <Stack gap="xs">
        <Text textStyle="label/S/medium">Counter step</Text>
        <Input value={String(step)} onChange={(event) => setStep(Number(event.target.value))} type="number" min={1} />
      </Stack>
      <HStack justify="space-between">
        <Text textStyle="label/S/medium">Counter enabled</Text>
        <Switch checked={enabled} onCheckedChange={(event: { checked: boolean }) => setEnabled(event.checked)} />
      </HStack>
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

export default createLabView(() => <ProjectSettings />);
