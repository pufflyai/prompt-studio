import { Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { TreeList } from "./tree-list";

const meta: Meta<typeof TreeList> = {
  title: "Components/Data Display/Tree List/Keyboard",
  component: TreeList,
};
export default meta;
type Story = StoryObj<typeof TreeList>;

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
  render: () => <KeyboardRows moveSelection />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole("option", { name: "Layer b", exact: true }).focus();
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    await waitFor(() =>
      expect(canvas.getAllByRole("option").map((row) => row.textContent)).toEqual([
        "Layer a",
        "Layer d",
        "Layer b",
        "Layer c",
      ]),
    );
    canvas.getByRole("option", { name: "Layer d", exact: true }).focus();
    await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
    await waitFor(() =>
      expect(canvas.getAllByRole("option").map((row) => row.textContent)).toEqual([
        "Layer d",
        "Layer a",
        "Layer b",
        "Layer c",
      ]),
    );
  },
};

export const SourceOnlyMoves: Story = {
  render: () => <KeyboardRows />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const source = canvas.getByRole("option", { name: "Layer b", exact: true });
    source.focus();
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    await waitFor(() =>
      expect(canvas.getAllByRole("option").map((row) => row.textContent)).toEqual(["Layer a", "Layer c", "Layer b"]),
    );
    await expect(source).toHaveFocus();
  },
};

export const MovesWithoutSelection: Story = {
  render: () => <KeyboardRows select={false} />,
  play: SourceOnlyMoves.play,
};

export const RangeFromEmptySelection: Story = {
  tags: ["!manifest"],
  render: () => <KeyboardRows empty />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole("option", { name: "Layer a", exact: true }).focus();
    await userEvent.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}");
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("Selected: a, b, c"));
    await expect(canvas.getByRole("option", { name: "Layer c", exact: true })).toHaveFocus();
    await userEvent.keyboard("{Shift>}{ArrowUp}{/Shift}");
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("Selected: a, b"));
  },
};
