import { Box } from "@chakra-ui/react";
import { FrameLoading } from "./frame-loading";

export default { title: "Canvas/Frame loading" };
export const Loading = {
  render: () => (
    <Box borderWidth="1px" borderColor="border.subtle" borderRadius="xs" maxW="xl">
      <FrameLoading name="FolderPickerDialog" />
    </Box>
  ),
};
