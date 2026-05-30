import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useState } from "react";

import { DeleteConfirmationModal } from "./delete-confirmation-modal";

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
