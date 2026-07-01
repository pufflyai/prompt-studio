import { Box, Button, Collapsible, Flex, Icon, Stack, Text } from "@chakra-ui/react";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { Param, ParamValue, ParamValueMap, ResourceRefValue } from "./param-editor.types";
import { ParamEditorField } from "./param-editor-field";

interface ParamEditorSectionProps {
  title?: string;
  description?: string;
  params: Param[];
  defaultValues: ParamValueMap;
  onChange: (id: string, value: ParamValue) => void;
  onOpenResource?: (ref: ResourceRefValue) => void;
  readOnly?: boolean;
  fullWidth?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  isFirst?: boolean;
}

const ParamEditorSectionTitle = (props: { title: string; description?: string }) => {
  const { title, description } = props;

  return (
    <Stack gap="2xs" minW="0" textAlign="left">
      <Text textStyle="label/M/medium" color="fg" truncate>
        {title}
      </Text>
      {description ? (
        <Text textStyle="label/XS/regular" color="fg.muted" lineClamp={2}>
          {description}
        </Text>
      ) : null}
    </Stack>
  );
};

const ParamEditorSectionHeader = (props: {
  title: string;
  description?: string;
  open: boolean;
  collapsible?: boolean;
  onToggle: () => void;
}) => {
  const { title, description, open, collapsible, onToggle } = props;

  if (!collapsible) {
    return (
      <Flex alignItems="center" justifyContent="space-between" minHeight="2.25rem" px="sm" py="xs">
        <ParamEditorSectionTitle title={title} description={description} />
      </Flex>
    );
  }

  return (
    <Button
      aria-expanded={open}
      borderRadius="0"
      height="auto"
      justifyContent="space-between"
      minHeight="2.25rem"
      onClick={onToggle}
      px="sm"
      py="xs"
      size="xs"
      variant="ghost"
      width="full"
      _expanded={{ bg: "transparent" }}
    >
      <ParamEditorSectionTitle title={title} description={description} />
      <Icon
        as={ChevronDown}
        boxSize="14px"
        color="fg.muted"
        flexShrink={0}
        transform={open ? "rotate(0deg)" : "rotate(-90deg)"}
        transition="transform 120ms ease"
      />
    </Button>
  );
};

const ParamEditorSectionBody = (props: Omit<ParamEditorSectionProps, "title" | "description" | "collapsible">) => {
  const { params, defaultValues, onChange, onOpenResource, readOnly, fullWidth, defaultCollapsed, isFirst } = props;

  return (
    <Stack gap="0" py={defaultCollapsed || isFirst ? "2xs" : "xs"}>
      {params.map((param) => (
        <Box key={param.id} px="sm" py="xs">
          <ParamEditorField
            param={param}
            defaultValues={defaultValues}
            onChange={onChange}
            onOpenResource={onOpenResource}
            readOnly={readOnly}
            fullWidth={fullWidth}
          />
        </Box>
      ))}
    </Stack>
  );
};

export const ParamEditorSection = (props: ParamEditorSectionProps) => {
  const {
    title,
    description,
    params,
    defaultValues,
    onChange,
    onOpenResource,
    readOnly,
    fullWidth,
    collapsible,
    defaultCollapsed = false,
    isFirst = false,
  } = props;
  const [open, setOpen] = useState(!defaultCollapsed);
  const hasTitle = Boolean(title);
  const canCollapse = Boolean(hasTitle && collapsible);
  const contentOpen = canCollapse ? open : true;

  return (
    <Stack as="section" gap="0" borderTopWidth={isFirst ? "0" : "1px"} borderColor="border.subtle" minW="0">
      {title ? (
        <ParamEditorSectionHeader
          title={title}
          description={description}
          open={contentOpen}
          collapsible={canCollapse}
          onToggle={() => setOpen((current) => !current)}
        />
      ) : null}
      <Collapsible.Root open={contentOpen}>
        <Collapsible.Content>
          <ParamEditorSectionBody
            params={params}
            defaultValues={defaultValues}
            onChange={onChange}
            onOpenResource={onOpenResource}
            readOnly={readOnly}
            fullWidth={fullWidth}
            defaultCollapsed={defaultCollapsed}
            isFirst={isFirst}
          />
        </Collapsible.Content>
      </Collapsible.Root>
    </Stack>
  );
};
