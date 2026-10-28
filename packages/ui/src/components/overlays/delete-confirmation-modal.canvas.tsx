import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { DeleteConfirmationModal } from "@/components/overlays/delete-confirmation-modal";
import { Checkbox } from "@/components/primitives/checkbox";

type StoryFn = () => ReactNode;

const meta = {
  title: "Components/Overlays/Delete Confirmation Modal",
  component: DeleteConfirmationModal,
  decorators: [
    (Story: StoryFn) => (
      <Box minH="320px" padding="sm" background="bg">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

export const Default = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);

    return (
      <Stack gap="md">
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Use the button below to reopen the confirmation modal after closing it.
        </Text>
        <Button size="sm" variant="outline" onClick={() => setIsOpen(true)}>
          Open confirmation modal
        </Button>
        <DeleteConfirmationModal
          open={isOpen}
          onClose={() => setIsOpen(false)}
          onDelete={() => setIsOpen(false)}
          headline="Delete pipeline?"
          notificationText="Deleting this pipeline will remove all versions. This action cannot be undone."
          buttonText="Delete pipeline"
        />
      </Stack>
    );
  },
};

export const WithOptInCheckbox = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);
    const [deleteData, setDeleteData] = useState(false);

    return (
      <Stack gap="md">
        <Button size="sm" variant="outline" onClick={() => setIsOpen(true)}>
          Open confirmation modal
        </Button>
        <DeleteConfirmationModal
          open={isOpen}
          onClose={() => {
            setIsOpen(false);
            setDeleteData(false);
          }}
          onDelete={() => setIsOpen(false)}
          headline="Uninstall extension?"
          notificationText='This removes "Planner" and deletes its installed files. Its stored data is kept so reinstalling restores it.'
          buttonText="Uninstall"
        >
          <Checkbox checked={deleteData} onCheckedChange={(details) => setDeleteData(details.checked === true)}>
            Also delete this extension's data (cannot be undone)
          </Checkbox>
        </DeleteConfirmationModal>
      </Stack>
    );
  },
};
