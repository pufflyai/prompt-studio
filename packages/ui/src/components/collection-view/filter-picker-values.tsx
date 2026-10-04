import { Icon, Stack } from "@chakra-ui/react";
import { normalizeBooleanViewRule, type ViewFilterRule } from "@pstdio/sdk/extensions";
import { Check, Type, X } from "lucide-react";
import { useState } from "react";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { ListRow } from "../list-row/list-row";
import { newRule, selectRuleValues } from "./collection-view-rules";
import { RuleValueEditor, type RuleValueOption } from "./filter-rule-value";

interface FilterPickerValuesProps {
  field: AttributeDescriptor;
  rule?: ViewFilterRule;
  options: RuleValueOption[];
  onSelectRule: (rule: ViewFilterRule) => void;
}

const ScalarPickerValue = (props: FilterPickerValuesProps & { rule: ViewFilterRule }) => {
  const { field, rule, options, onSelectRule } = props;
  const [value, setValue] = useState(rule.value);
  const complete = value !== undefined && value !== "";
  const submit = () => {
    if (complete) onSelectRule(selectRuleValues(field, rule, value));
  };
  return (
    <Stack
      gap="xs"
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submit();
        }
      }}
    >
      <RuleValueEditor field={field} rule={{ ...rule, value }} options={options} onChange={setValue} />
      <ListRow
        id="apply-filter"
        role="button"
        variant="compact"
        label="Apply filter"
        disabled={!complete}
        onActivate={submit}
      />
    </Stack>
  );
};

/** Property browsing is read-only. A value (or the explicit text action) commits a rule. */
export const FilterPickerValues = (props: FilterPickerValuesProps) => {
  const { field, options, onSelectRule } = props;
  const source = normalizeBooleanViewRule(props.rule ?? newRule(field), field.type);
  const scalar = ["string", "number", "date"].includes(field.type.kind);
  const rule = scalar && ["is-empty", "is-not-empty"].includes(source.condition) ? newRule(field) : source;
  if (field.type.kind === "string")
    return (
      <ListRow
        id="filter-by-text"
        role="button"
        variant="compact"
        label="Filter by text"
        icon={<Icon as={Type} boxSize="3" />}
        onActivate={() => onSelectRule(rule)}
      />
    );
  if (field.type.kind === "boolean")
    return (
      <Stack gap="0">
        {[true, false].map((value) => (
          <ListRow
            key={String(value)}
            id={String(value)}
            role="button"
            variant="compact"
            icon={<Icon as={value ? Check : X} boxSize="3" />}
            label={value ? "Yes" : "No"}
            onActivate={() => onSelectRule(selectRuleValues(field, rule, value))}
          />
        ))}
      </Stack>
    );
  if (field.type.kind === "number" || field.type.kind === "date")
    return <ScalarPickerValue key={field.id} {...props} rule={rule} />;
  return (
    <RuleValueEditor
      field={field}
      rule={rule}
      options={options}
      onChange={(value) => {
        if (value === undefined || value === "") return;
        // Clicking the last selected value resumes the bubble without committing an empty rule.
        if (Array.isArray(value) && value.length === 0) {
          onSelectRule(rule);
          return;
        }
        onSelectRule(selectRuleValues(field, rule, value));
      }}
    />
  );
};
