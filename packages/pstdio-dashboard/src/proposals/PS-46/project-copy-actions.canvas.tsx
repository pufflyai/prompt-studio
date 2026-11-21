import { Box, Button, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { Checkbox, DeleteConfirmationModal, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useState } from "react";

type Presence = "downloaded" | "cloud-only" | "downloading" | "deleting";
type Confirmation = "local" | "cloud" | null;
const name = "Prompt Studio";

const CopyActions = ({ online }: { online: boolean }) => {
  const [presence, setPresence] = useState<Presence>("downloaded");
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [preflight, setPreflight] = useState("pending");
  const [discard, setDiscard] = useState(false);
  const [completed, setCompleted] = useState(false);
  const back = () => {
    setConfirmation(null);
    setDiscard(false);
  };
  const submit = () => {
    if (confirmation === "local") {
      if (!discard) return;
      back();
      setPresence("cloud-only");
    } else {
      back();
      setPresence("deleting");
    }
  };
  const download = () => setPresence("downloading");

  return (
    <Stack gap="md">
      <Text textStyle="heading/M">{name}</Text>
      {presence === "downloaded" && (
        <SimpleCard variant="destructive">
          <SimpleCardBody>
            <Stack gap="md">
              <HStack justify="space-between" align="start">
                <Stack gap="xs">
                  <Text textStyle="label/M/medium">Delete local version</Text>
                  <Text textStyle="paragraph/S/regular" color="fg.muted">
                    Remove downloaded data from this device. Other devices keep their copies.
                  </Text>
                </Stack>
                <Button size="sm" variant="destructive" onClick={() => setConfirmation("local")}>
                  Delete local version
                </Button>
              </HStack>
              <HStack justify="space-between" align="start">
                <Stack gap="xs">
                  <Text textStyle="label/M/medium">Delete cloud project</Text>
                  <Text textStyle="paragraph/S/regular" color="fg.muted">
                    Permanently remove Cloud data and history. Downloaded copies become local projects.
                  </Text>
                </Stack>
                <Button size="sm" variant="destructive" disabled={!online} onClick={() => setConfirmation("cloud")}>
                  Delete cloud project
                </Button>
              </HStack>
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
      )}
      {presence === "cloud-only" && (
        <Stack gap="md">
          <Text>Cloud only</Text>
          {!online && <Text color="fg.muted">Connect to Cloud to download or delete this project.</Text>}
          <HStack justify="space-between" flexWrap="wrap">
            <Button size="sm" variant="destructive" disabled={!online} onClick={() => setConfirmation("cloud")}>
              Delete cloud project
            </Button>
            <HStack>
              <Button size="sm" variant="ghost" onClick={() => setPresence("downloaded")}>
                Back
              </Button>
              <Button size="sm" disabled={!online} onClick={download}>
                Download
              </Button>
            </HStack>
          </HStack>
        </Stack>
      )}
      {presence === "downloading" && (
        <HStack role="status">
          <Spinner size="sm" />
          <Text>Downloading project</Text>
          <Button size="sm" variant="ghost" onClick={() => setPresence("cloud-only")}>
            Back
          </Button>
        </HStack>
      )}
      {presence === "deleting" && (
        <HStack role="status">
          {!completed && <Spinner size="sm" />}
          <Text>{completed ? "Cloud project deleted" : "Deleting cloud project"}</Text>
          {!completed && (
            <Button size="sm" onClick={() => setCompleted(true)}>
              Finish cleanup in preview
            </Button>
          )}
        </HStack>
      )}
      {confirmation === "local" && (
        <SimpleCard variant="destructive">
          <SimpleCardBody>
            <Stack gap="md">
              <Text textStyle="heading/M">Delete local version of “{name}”?</Text>
              <Text>This removes downloaded data, recovery copies, and app-owned folders from this device.</Text>
              <Text color="fg.error">
                {preflight === "pending"
                  ? "Pending changes have not uploaded and will be lost."
                  : "Unsynced changes may be lost."}
              </Text>
              <Checkbox checked={discard} onCheckedChange={({ checked }) => setDiscard(checked === true)}>
                Discard unsynced changes
              </Checkbox>
              <HStack justify="end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPreflight(preflight === "pending" ? "unknown" : "pending")}
                >
                  Change upload state in preview
                </Button>
                <Button size="sm" onClick={back}>
                  Close
                </Button>
                <Button size="sm" variant="destructive" disabled={!discard} onClick={submit}>
                  Delete local version
                </Button>
              </HStack>
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
      )}
      <DeleteConfirmationModal
        open={confirmation === "cloud"}
        onClose={back}
        onDelete={submit}
        headline={`Delete cloud project “${name}”?`}
        notificationText="Cloud data, files, history, recovery data, and encryption keys will be permanently deleted. Current device copies stay as local projects, including offline edits."
        buttonText="Delete cloud project"
      />
    </Stack>
  );
};

const meta = {
  title: "Proposals/PS-46 Delete or download a Cloud project",
  component: CopyActions,
  args: { online: true },
  decorators: [
    (Frame) => (
      <Box w="lg" p="md">
        <Frame />
      </Box>
    ),
  ],
} satisfies CanvasMeta<typeof CopyActions>;
export default meta;
export const DeviceAndCloudCopies: CanvasFrame<typeof meta> = {
  id: "projects-ps-46-device-and-cloud-copies",
  controls: { online: { type: "boolean" } },
};
