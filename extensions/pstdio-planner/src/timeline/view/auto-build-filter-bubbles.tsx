import { Flex, HStack, Text } from "@chakra-ui/react";
import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import type { AttributeDescriptor } from "@pstdio/ui/kanban-renderer";
import { autoBuildRuleParts } from "./auto-build-filter-labels";

interface AutoBuildFilterBubblesProps {
  filter: ViewFilterGroup;
  fields: AttributeDescriptor[];
  itemLabel: string;
}

function groupLabel(group: ViewFilterGroup, fields: AttributeDescriptor[], itemLabel: string) {
  const labels: string[] = group.rules.map((rule) => autoBuildRuleParts(rule, fields, itemLabel).join(" "));
  for (const child of group.groups ?? []) labels.push(`(${groupLabel(child, fields, itemLabel)})`);
  return labels.join(group.conjunction === "and" ? " and " : " or ");
}

function FilterBubble(props: { parts: string[]; label: string }) {
  const { parts, label } = props;
  return (
    <HStack role="group" aria-label={label} layerStyle="filterPill" gap="0" flexShrink="0">
      {parts.map((part, index) => (
        <Text
          key={index}
          as="span"
          textStyle="label/XS"
          layerStyle={index < parts.length - 1 ? "filterLabel" : undefined}
          px={index === parts.length - 1 ? "xs" : undefined}
          alignItems="center"
          color={index === parts.length - 1 ? "fg" : "fg.muted"}
        >
          {part}
        </Text>
      ))}
    </HStack>
  );
}

export function AutoBuildFilterBubbles(props: AutoBuildFilterBubblesProps) {
  const { filter, fields, itemLabel } = props;
  if (filter.conjunction === "or")
    return <FilterBubble label="Applied filters" parts={[groupLabel(filter, fields, itemLabel)]} />;
  return (
    <Flex aria-label="Applied filters" direction="column" align="flex-start" gap="2xs">
      {filter.rules.map((rule, index) => (
        <FilterBubble
          key={`${index}:${rule.attributeId}`}
          label={`${fields.find(({ id }) => id === rule.attributeId)?.label ?? rule.attributeId} filter`}
          parts={autoBuildRuleParts(rule, fields, itemLabel)}
        />
      ))}
      {filter.groups?.map((group, index) => (
        <FilterBubble key={index} label="Advanced filter" parts={[groupLabel(group, fields, itemLabel)]} />
      ))}
    </Flex>
  );
}
