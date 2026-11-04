import { Button, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, DeleteConfirmationModal, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { WorkbenchIcon } from "@pstdio/workbench/react";
import { useState } from "react";
import { SettingsPage } from "./settings-page";

// This proposal uses synthetic state; deleting never calls the project API.
export const DangerZone = () => {
  const [confirm, setConfirm] = useState(false);
  const [deleted, setDeleted] = useState(false);
  return (
    <SettingsPage pageId="danger-zone">
      {deleted ? (
        <AlertMessage status="success" title="Project deleted" />
      ) : (
        <SimpleCard variant="destructive">
          <SimpleCardBody>
            <Stack gap="sm">
              <Text textStyle="label/M/medium" color="fg.error">
                Delete project
              </Text>
              <Text textStyle="paragraph/S/regular">
                Delete this project and all related data. This action cannot be undone.
              </Text>
              <Button size="sm" variant="destructive" alignSelf="start" onClick={() => setConfirm(true)}>
                <WorkbenchIcon name="Trash2" size="1em" />
                Delete project
              </Button>
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
      )}
      <DeleteConfirmationModal
        open={confirm}
        onClose={() => setConfirm(false)}
        headline="Delete Prompt Studio?"
        notificationText="This removes the project and all related data. This action cannot be undone."
        buttonText="Delete project"
        onDelete={() => setDeleted(true)}
      />
    </SettingsPage>
  );
};
