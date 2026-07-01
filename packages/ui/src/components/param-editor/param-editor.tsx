import { Stack } from "@chakra-ui/react";
import type { InputGroup, Param, ParamValue, ParamValueMap, ResourceRefValue } from "./param-editor.types";
import { ParamEditorSection } from "./param-editor-section";

export interface ParamEditorProps {
  params?: Param[];
  groups?: InputGroup[];
  defaultValues?: ParamValueMap;
  onChange?: (id: string, value: ParamValue) => void;
  onOpenResource?: (ref: ResourceRefValue) => void;
  readOnly?: boolean;
  fullWidth?: boolean;
}

export const ParamEditor = (props: ParamEditorProps) => {
  const { params = [], groups = [], defaultValues = {}, onChange, onOpenResource, readOnly, fullWidth = false } = props;
  const handleChange = onChange ?? (() => undefined);

  return (
    <Stack flex="1" maxW="full" gap="0">
      {params.length > 0 ? (
        <ParamEditorSection
          params={params}
          defaultValues={defaultValues}
          onChange={handleChange}
          onOpenResource={onOpenResource}
          readOnly={readOnly}
          fullWidth={fullWidth}
          isFirst
        />
      ) : null}
      {groups.map((group, index) => (
        <ParamEditorSection
          key={group.id}
          title={group.title}
          description={group.description}
          params={group.params}
          defaultValues={defaultValues}
          onChange={handleChange}
          onOpenResource={onOpenResource}
          readOnly={readOnly}
          fullWidth={fullWidth}
          collapsible={group.collapsible}
          defaultCollapsed={group.defaultCollapsed}
          isFirst={params.length === 0 && index === 0}
        />
      ))}
    </Stack>
  );
};
