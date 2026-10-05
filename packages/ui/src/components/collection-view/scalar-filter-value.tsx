import { Button, Input, Text } from "@chakra-ui/react";
import { useRef, useState } from "react";
import { NumberInputField, NumberInputRoot } from "../primitives/number-input";
import { dayLabel } from "./collection-view-labels";
import type { RuleValueProps } from "./filter-rule-value";
import { FilterValuePanel } from "./filter-value-panel";
import { ViewBarPopover } from "./view-bar-popover";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const NumberParameterValue = (props: RuleValueProps) => {
  const { rule, onChange } = props;
  const value = typeof rule.value === "number" ? rule.value : undefined;
  const [draft, setDraft] = useState({ source: value, text: value === undefined ? "" : String(value) });
  if (draft.source !== value) setDraft({ source: value, text: value === undefined ? "" : String(value) });
  return (
    <NumberInputRoot
      size="sm"
      width="full"
      value={draft.text}
      onValueChange={(details) => {
        const source = Number.isFinite(details.valueAsNumber) ? details.valueAsNumber : undefined;
        // Keep the decimal point and caret while typing; project only complete numbers into the rule.
        setDraft({ source, text: details.value });
        onChange(source);
      }}
    >
      <NumberInputField aria-label="Value" />
    </NumberInputRoot>
  );
};

/** Use the parameter-field scaffold and recipes, while filter drafts update immediately. */
export const ScalarValueEditor = (props: RuleValueProps) => {
  const { field, rule, onChange } = props;
  const value = typeof rule.value === "string" ? rule.value : "";
  if (field.type.kind === "date")
    return (
      <FilterValuePanel>
        <Input
          aria-label="Value"
          type="date"
          size="sm"
          width="full"
          value={ISO_DAY.test(value) ? value : ""}
          onChange={(event) => onChange(event.target.value || undefined)}
        />
      </FilterValuePanel>
    );
  return (
    <FilterValuePanel>
      {field.type.kind === "number" ? (
        <NumberParameterValue {...props} />
      ) : (
        <Input
          aria-label="Value"
          size="sm"
          placeholder="Enter text…"
          width="full"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </FilterValuePanel>
  );
};

/** Date editing uses the same exact-date field wherever the rule is opened. */
export const DateBubbleValue = (props: RuleValueProps) => {
  const { rule, variant } = props;
  const [localOpen, setLocalOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const open = props.open ?? localOpen;
  const setOpen = props.onOpenChange ?? setLocalOpen;
  return (
    <>
      <Button
        ref={anchorRef}
        aria-label="Values"
        variant={variant ?? "subtle"}
        size="2xs"
        onClick={() => setOpen(!open)}
      >
        <Text textStyle="label/XS">{typeof rule.value === "string" ? dayLabel(rule.value) : "Choose date…"}</Text>
      </Button>
      <ViewBarPopover open={open} onOpenChange={setOpen} anchorRef={anchorRef} width="18rem" padding="0">
        <ScalarValueEditor {...props} />
      </ViewBarPopover>
    </>
  );
};
