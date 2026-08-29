import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { WebviewFilesClient } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { useLabHost } from "../hooks/host-context";
import { LabCard } from "./lab-card";

const expectedText = "Extension Lab webview file bytes";
type ExtensionBlobRef = Awaited<ReturnType<WebviewFilesClient["upload"]>>;

interface CommandResponse {
  outcome: {
    reason?: string;
    status: "error" | "rejected" | "success";
    value?: { text?: string };
  };
}

export const FileCapabilitiesCard = () => {
  const { host } = useLabHost();
  const [result, setResult] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const testFiles = async () => {
    setIsPending(true);
    setResult(null);
    try {
      const uploaded = await host.call<ExtensionBlobRef>("files.upload", {
        name: "webview-capability.txt",
        data: new TextEncoder().encode(expectedText),
        mimeType: "text/plain",
      });
      const response = await host.call<CommandResponse>("commands.execute", {
        commandId: "pstdio.extension-lab.command.webview-file.read",
        params: { id: uploaded.id },
      });
      if (response.outcome.status !== "success" || response.outcome.value?.text !== expectedText) {
        throw new Error(response.outcome.reason ?? "Uploaded bytes did not match.");
      }

      const listed = await host.call<{ files: ExtensionBlobRef[] }>("files.list", {});
      if (!listed.files.some((file) => file.id === uploaded.id)) throw new Error("Uploaded file was not listed.");
      await host.call("files.delete", { id: uploaded.id });
      const afterDelete = await host.call<{ files: ExtensionBlobRef[] }>("files.list", {});
      if (afterDelete.files.some((file) => file.id === uploaded.id)) throw new Error("Deleted file was still listed.");

      setResult("Upload, read, list, and delete passed.");
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPending(false);
    }
  };

  const openResource = () =>
    host.call("resource.open", {
      resource: { type: "blend-project", id: "file-capability", label: "File capability project" },
      input: { strategy: "replace-active" },
    });

  return (
    <LabCard title="Webview files" subtitle="Host-owned files and resource navigation through declared capabilities.">
      <Stack gap="md">
        <HStack gap="xs" wrap="wrap">
          <Button type="button" variant="primary" disabled={isPending} onClick={testFiles}>
            Test file capabilities
          </Button>
          <Button type="button" variant="outline" onClick={() => void openResource()}>
            Open file capability resource
          </Button>
        </HStack>
        {result ? (
          <Text textStyle="paragraph/S/regular" color={result.endsWith("passed.") ? "fg.success" : "fg.error"}>
            {result}
          </Text>
        ) : null}
      </Stack>
    </LabCard>
  );
};
