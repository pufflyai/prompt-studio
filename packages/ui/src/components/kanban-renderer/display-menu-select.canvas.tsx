import { Box, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { DisplayMenuSelect } from "./display-menu";

const LongGroupingMenu = () => {
  const [value, setValue] = useState("none");
  return (
    <Box width="18rem">
      <DisplayMenuSelect
        label="Grouping"
        value={value}
        onSelect={setValue}
        options={[
          { value: "none", label: "None" },
          ...Array.from({ length: 30 }, (_, index) => ({ value: String(index), label: `Property ${index + 1}` })),
        ]}
      />
      <Text data-testid="grouping">{value}</Text>
    </Box>
  );
};
const meta: CanvasMeta = { title: "Patterns/Collection View/Display Select" };
export default meta;
type Story = CanvasFrame;
export const LongOptions: Story = {
  id: "patterns-collection-view-display-select--long-options",
  render: () => <LongGroupingMenu />,
};
