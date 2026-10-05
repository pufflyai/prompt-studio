import { Box, Button, Icon, Stack } from "@chakra-ui/react";
import { normalizeBooleanViewRule, type ViewFilterRule } from "@pstdio/sdk/extensions";
import { Check, X } from "lucide-react";
import { useState } from "react";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { ListRow } from "../list-row/list-row";
import { Checkbox } from "../primitives/checkbox";
import { ScrollArea } from "../primitives/scroll-area";
import { newRule, selectRuleValues } from "./collection-view-rules";
import { RuleValueEditor, type RuleValueOption } from "./filter-rule-value";
import { FilterValuePanel } from "./filter-value-panel";

interface FilterPickerValuesProps {
  field: AttributeDescriptor;
  rule?: ViewFilterRule;
  options: RuleValueOption[];
  onSelectRule: (rule: ViewFilterRule) => void;
}

const ScalarPickerValue = (props: FilterPickerValuesProps & { rule: ViewFilterRule }) => {
  const { field, rule, options, onSelectRule } = props;
  const [value, setValue] = useState(rule.value);
  const text = field.type.kind === "string";
  const complete = text || (value !== undefined && value !== "");
  const submit = () => {
    if (complete) onSelectRule(selectRuleValues(field, rule, value));
  };
  return (
    <Stack
      height="full"
      minH="0"
      gap="xs"
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submit();
        }
      }}
    >
      <ScrollArea flex="1" minH="0" viewportProps={{ overscrollBehavior: "contain" }}>
        <RuleValueEditor field={field} rule={{ ...rule, value }} options={options} onChange={setValue} />
      </ScrollArea>
      <Box paddingX="sm" paddingBottom="sm" flexShrink={0}>
        <Button size="sm" variant="primary" width="full" disabled={!complete} onClick={submit}>
          Apply filter
        </Button>
      </Box>
    </Stack>
  );
};

/** Browsing does not add a rule. Values commit immediately; scalar drafts use Apply filter. */
export const FilterPickerValues = (props: FilterPickerValuesProps) => {
  const { field, options, onSelectRule } = props;
  const source = normalizeBooleanViewRule(props.rule ?? newRule(field), field.type);
  const scalar = ["string", "number", "date"].includes(field.type.kind);
  const rule = scalar && ["is-empty", "is-not-empty"].includes(source.condition) ? newRule(field) : source;
  if (field.type.kind === "boolean")
    return (
      <FilterValuePanel>
        <Stack gap="0">
          {[true, false].map((value) => (
            <ListRow
              key={String(value)}
              id={String(value)}
              role="button"
              variant="compact"
              icon={<Icon as={value ? Check : X} boxSize="3" />}
              label={value ? "Yes" : "No"}
              endContent={
                <Checkbox
                  checked={
                    Boolean(props.rule) &&
                    typeof rule.value === "boolean" &&
                    (rule.condition === "is-not" ? !rule.value : rule.value) === value
                  }
                  readOnly
                  inputProps={{ tabIndex: -1, "aria-hidden": true }}
                  pointerEvents="none"
                  size="xs"
                />
              }
              onActivate={() => onSelectRule(selectRuleValues(field, rule, value))}
            />
          ))}
        </Stack>
      </FilterValuePanel>
    );
  if (scalar) return <ScalarPickerValue key={field.id} {...props} rule={rule} />;
  return (
    <RuleValueEditor
      field={field}
      rule={rule}
      options={options}
      onChange={(value) => {
        if (value === undefined || value === "") return;
        onSelectRule(selectRuleValues(field, rule, value));
      }}
    />
  );
};
