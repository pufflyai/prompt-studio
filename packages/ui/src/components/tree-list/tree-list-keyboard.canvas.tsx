import { Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { TreeList } from "./tree-list";

const meta: CanvasMeta<typeof TreeList> = {
  title: "Components/Data Display/Tree List/Keyboard",
  component: TreeList,
};
export default meta;
type Story = CanvasFrame<typeof TreeList>;
const KeyboardRows = (props: { empty?: boolean; moveSelection?: boolean; select?: boolean }) => {
  const { empty, moveSelection, select = true } = props;
  const [selected, setSelected] = useState<string[]>(empty ? [] : ["b", "c"]);
  const [order, setOrder] = useState(moveSelection ? ["a", "b", "c", "d"] : ["a", "b", "c"]);
  return (
    <Stack w="80">
      <TreeList
        sections={[
          {
            id: "rows",
            nodes: order.map((id) => ({ id, label: `Layer ${id}`, canDrag: true, canDrop: true })),
          },
        ]}
        activeNodeId={selected}
        onSelectionChange={select ? setSelected : undefined}
        moveSelection={moveSelection}
        onMoveNode={(source, target, position) => {
          if (!target) return;
          const moving = order.filter((id) =>
            moveSelection && selected.includes(source) ? selected.includes(id) : id === source,
          );
          const next = order.filter((id) => !moving.includes(id));
          next.splice(next.indexOf(target) + (position === "after" ? 1 : 0), 0, ...moving);
          setOrder(next);
        }}
      />
      <Text role="status" textStyle="label/XS">
        Selected: {selected.join(", ")}
      </Text>
    </Stack>
  );
};
export const SelectionMoves: Story = {
  id: "components-data-display-tree-list-keyboard--selection-moves",
  render: () => <KeyboardRows moveSelection />,
};
export const SourceOnlyMoves: Story = {
  id: "components-data-display-tree-list-keyboard--source-only-moves",
  render: () => <KeyboardRows />,
};
export const MovesWithoutSelection: Story = {
  id: "components-data-display-tree-list-keyboard--moves-without-selection",
  render: () => <KeyboardRows select={false} />,
};
export const RangeFromEmptySelection: Story = {
  id: "components-data-display-tree-list-keyboard--range-from-empty-selection",
  render: () => <KeyboardRows empty />,
};
