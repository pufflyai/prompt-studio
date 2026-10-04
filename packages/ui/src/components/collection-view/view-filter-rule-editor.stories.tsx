import { Box } from "@chakra-ui/react";
import type { ViewFilterRule } from "@pstdio/sdk/extensions";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { findField } from "./collection-view-fields";
import { storyFields, storyOptions } from "./collection-view-story-fixtures";
import { ViewFilterRuleEditor } from "./view-filter-rule-editor";

const meta: Meta<typeof ViewFilterRuleEditor> = {
  title: "Patterns/Collection View/View Filter Rule Editor",
  component: ViewFilterRuleEditor,
};

export default meta;

type Story = StoryObj;

const Editor = (props: { rule: ViewFilterRule }) => {
  const [rule, setRule] = useState(props.rule);
  const field = findField(storyFields, rule.attributeId)!;
  return (
    <Box width="18.75rem" padding="2xs" borderWidth="1px" borderColor="border" borderRadius="md" bg="bg">
      <ViewFilterRuleEditor
        field={field}
        rule={rule}
        options={storyOptions(field)}
        onChange={setRule}
        onDelete={() => undefined}
      />
    </Box>
  );
};

export const OptionField: Story = {
  render: () => <Editor rule={{ attributeId: "status", condition: "is-none-of", value: ["done"] }} />,
};

export const TextField: Story = {
  render: () => <Editor rule={{ attributeId: "title", condition: "contains", value: "chat" }} />,
};

export const NumberField: Story = {
  render: () => <Editor rule={{ attributeId: "score", condition: "gte", value: 70 }} />,
};

/** A day relative to today stays current when the view opens later; an exact day stays fixed. */
export const DateField: Story = {
  render: () => <Editor rule={{ attributeId: "updated", condition: "is-after", value: "today-7" }} />,
};
