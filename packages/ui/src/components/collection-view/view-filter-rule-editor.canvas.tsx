import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import type { ViewFilterRule } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { findField } from "./collection-view-fields";
import { storyFields, storyOptions } from "./collection-view-story-fixtures";
import { ViewFilterRuleEditor } from "./view-filter-rule-editor";

const meta: CanvasMeta<typeof ViewFilterRuleEditor> = {
  title: "Patterns/Collection View/View Filter Rule Editor",
  component: ViewFilterRuleEditor,
};
export default meta;
type Story = CanvasFrame;
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
  id: "patterns-collection-view-view-filter-rule-editor--option-field",
  render: () => <Editor rule={{ attributeId: "status", condition: "is-none-of", value: ["done"] }} />,
};
export const TextField: Story = {
  id: "patterns-collection-view-view-filter-rule-editor--text-field",
  render: () => <Editor rule={{ attributeId: "title", condition: "contains", value: "chat" }} />,
};
export const NumberField: Story = {
  id: "patterns-collection-view-view-filter-rule-editor--number-field",
  render: () => <Editor rule={{ attributeId: "score", condition: "gte", value: 70 }} />,
};
/** The Value field edits an exact calendar day. */
export const DateField: Story = {
  id: "patterns-collection-view-view-filter-rule-editor--date-field",
  render: () => <Editor rule={{ attributeId: "updated", condition: "is-after", value: "2026-10-05" }} />,
};
