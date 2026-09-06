import { Button, Stack, Text } from "@chakra-ui/react";
import { unwrapCommandOutcome } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { useLabHost } from "../hooks/host-context";
import { LabCard } from "./lab-card";

const expectedText = "Extension Lab webview file bytes";

export const FileCapabilitiesCard = () => {
  const { host } = useLabHost();
  const [result, setResult] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const testFiles = async () => {
    setIsPending(true);
    setResult(null);
    try {
      const uploaded = await host.call("files.upload", {
        name: "webview-capability.txt",
        data: new TextEncoder().encode(expectedText),
        mimeType: "text/plain",
      });
      const response = await host.call("commands.execute", {
        commandId: "pstdio.workbench-fixture.command.webview-file.read",
        params: { id: uploaded.id },
      });
      const value = unwrapCommandOutcome(response);
      if (!value || typeof value !== "object" || !("text" in value) || value.text !== expectedText) {
        throw new Error("Uploaded bytes did not match.");
      }

      const listed = await host.call("files.list", {});
      if (!listed.files.some((file) => file.id === uploaded.id)) throw new Error("Uploaded file was not listed.");
      await host.call("files.delete", { id: uploaded.id });
      const afterDelete = await host.call("files.list", {});
      if (afterDelete.files.some((file) => file.id === uploaded.id)) throw new Error("Deleted file was still listed.");

      setResult("Upload, read, list, and delete passed.");
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <LabCard title="Webview files" subtitle="Host-owned files through declared capabilities.">
      <Stack gap="md">
        <Button type="button" variant="primary" disabled={isPending} onClick={testFiles} alignSelf="start">
          Test file capabilities
        </Button>
        {result ? (
          <Text textStyle="paragraph/S/regular" color={result.endsWith("passed.") ? "fg.success" : "fg.error"}>
            {result}
          </Text>
        ) : null}
      </Stack>
    </LabCard>
  );
};
