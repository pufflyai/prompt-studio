import { Box, Stack, Text } from "@chakra-ui/react";
import { DataTableSkeleton } from ".";

const meta = {
  title: "Components/Data Display/Data Table",
  component: DataTableSkeleton,
};

export default meta;

export const LoadingSkeleton = {
  render: () => (
    <Stack width="100%" maxWidth="820px" marginX="auto" padding="sm" gap="md" background="bg">
      <Box>
        <Text textStyle="label/S/medium" marginBottom="xs">
          Known columns: real headers render instantly, only the rows shimmer.
        </Text>
        <DataTableSkeleton
          columns={[
            { id: "name", label: "Name" },
            { id: "status", label: "Status" },
            { id: "amount", label: "Amount" },
          ]}
        />
      </Box>
      <Box>
        <Text textStyle="label/S/medium" marginBottom="xs">
          Unknown columns: header cells shimmer too.
        </Text>
        <DataTableSkeleton columnCount={4} rowCount={3} />
      </Box>
    </Stack>
  ),
};
