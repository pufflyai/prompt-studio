import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { CustomizationsContent } from "./customizations";

const Example = (props: { initialHidden: boolean }) => {
  const [hidden, setHidden] = useState(props.initialHidden);
  return <CustomizationsContent hidden={hidden} onChange={setHidden} />;
};
const meta = { title: "Settings/Customizations", component: Example, args: { initialHidden: false } } satisfies Meta<
  typeof Example
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Hidden: Story = { args: { initialHidden: true } };
