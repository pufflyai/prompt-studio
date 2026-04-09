import { Button, CloseButton, Dialog, Icon, Input, Menu, Stack, Text, Textarea } from "@chakra-ui/react";
import { MenuItem } from "@pstdio/ui";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useProjectTemplateAssets } from "@/features/project/hooks/use-project";
import type { ActionDescriptor, ActionParamDescriptor, ActionParamValue } from "../api";
import { AgentParamField, RepoParamField } from "./action-param-composite-fields";

interface ActionParamsDialogProps {
  open: boolean;
  action: ActionDescriptor;
  projectId: string;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (params: Record<string, ActionParamValue>) => boolean | undefined | Promise<boolean | undefined>;
}

export const isActionParamValueFilled = (param: ActionParamDescriptor, value: ActionParamValue | undefined) => {
  if (value == null) return false;

  if (typeof value === "string") {
    return value.length > 0;
  }

  if (param.type === "agent") {
    return typeof value.agent === "string" && value.agent.length > 0;
  }

  if (param.type === "repo") {
    return typeof value.repo === "string" && value.repo.length > 0;
  }

  return true;
};

export const ActionParamsDialog = (props: ActionParamsDialogProps) => {
  const { open, action, projectId, isSubmitting = false, onClose, onSubmit } = props;
  const [values, setValues] = useState<Record<string, ActionParamValue>>({});

  const params = action.params ?? [];

  const handleClose = () => {
    if (isSubmitting) return;
    setValues({});
    onClose();
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    const result = await onSubmit(values);
    if (result === false) return;

    setValues({});
    onClose();
  };

  const setValue = (key: string, value: ActionParamValue) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const isValid = params.filter((p) => p.required !== false).every((p) => isActionParamValueFilled(p, values[p.key]));

  return (
    <Dialog.Root open={open} onOpenChange={(details) => !details.open && handleClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Text textStyle="heading/M">{action.label}</Text>
            <Dialog.CloseTrigger>
              <CloseButton size="sm" disabled={isSubmitting} />
            </Dialog.CloseTrigger>
          </Dialog.Header>

          <Dialog.Body>
            <Stack gap="sm">
              {params.map((param) => (
                <ActionParamField
                  key={param.key}
                  param={param}
                  projectId={projectId}
                  value={values[param.key]}
                  onChange={(val) => setValue(param.key, val)}
                  isDisabled={isSubmitting}
                />
              ))}
            </Stack>
          </Dialog.Body>

          <Dialog.Footer>
            <Stack direction="row" gap="1">
              <Button size="sm" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => void handleSubmit()}
                loading={isSubmitting}
                disabled={!isValid}
              >
                Run
              </Button>
            </Stack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};

// -- Individual param field renderers ----------------------------------------

interface ActionParamFieldProps {
  param: ActionParamDescriptor;
  projectId: string;
  value: ActionParamValue | undefined;
  onChange: (value: ActionParamValue) => void;
  isDisabled: boolean;
}

const ActionParamField = (props: ActionParamFieldProps) => {
  const { param, projectId, value, onChange, isDisabled } = props;

  switch (param.type) {
    case "text":
      return <TextParamField param={param} value={value as string} onChange={onChange} isDisabled={isDisabled} />;
    case "longtext":
      return <LongTextParamField param={param} value={value as string} onChange={onChange} isDisabled={isDisabled} />;
    case "select":
      return <SelectParamField param={param} value={value as string} onChange={onChange} isDisabled={isDisabled} />;
    case "template-select":
      return (
        <TemplateSelectParamField
          param={param}
          projectId={projectId}
          value={value as string}
          onChange={onChange}
          isDisabled={isDisabled}
        />
      );
    case "agent":
      return <AgentParamField param={param} onChange={onChange} isDisabled={isDisabled} />;
    case "repo":
      return <RepoParamField param={param} projectId={projectId} onChange={onChange} isDisabled={isDisabled} />;
    default:
      return null;
  }
};

interface SimpleParamFieldProps {
  param: ActionParamDescriptor;
  value: string | undefined;
  onChange: (value: string) => void;
  isDisabled: boolean;
}

const TextParamField = ({ param, value, onChange, isDisabled }: SimpleParamFieldProps) => (
  <Stack gap="2xs">
    <Text textStyle="label/S/medium">{param.label}</Text>
    {param.description ? (
      <Text textStyle="paragraph/XS/regular" color="foreground.secondary">
        {param.description}
      </Text>
    ) : null}
    <Input
      size="sm"
      value={value ?? param.defaultValue ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={isDisabled}
    />
  </Stack>
);

const LongTextParamField = ({ param, value, onChange, isDisabled }: SimpleParamFieldProps) => (
  <Stack gap="2xs">
    <Text textStyle="label/S/medium">{param.label}</Text>
    {param.description ? (
      <Text textStyle="paragraph/XS/regular" color="foreground.secondary">
        {param.description}
      </Text>
    ) : null}
    <Textarea
      size="sm"
      minH="100px"
      value={value ?? param.defaultValue ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={isDisabled}
    />
  </Stack>
);

const SelectParamField = ({ param, value, onChange, isDisabled }: SimpleParamFieldProps) => {
  const options = param.options ?? [];
  const selected = value ?? param.defaultValue ?? "";
  const selectedLabel = options.find((o) => o.value === selected)?.label ?? (selected || "Select...");

  return (
    <Stack gap="2xs">
      <Text textStyle="label/S/medium">{param.label}</Text>
      {param.description ? (
        <Text textStyle="paragraph/XS/regular" color="foreground.secondary">
          {param.description}
        </Text>
      ) : null}
      <Menu.Root>
        <Menu.Trigger asChild>
          <Button size="sm" variant="outline" width="full" justifyContent="space-between" disabled={isDisabled}>
            {selectedLabel}
            <Icon as={ChevronDown} color="fg.muted" />
          </Button>
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content bg="bg">
            {options.map((option) => (
              <MenuItem
                key={option.value}
                primaryLabel={option.label}
                isSelected={selected === option.value}
                onClick={() => onChange(option.value)}
              />
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
    </Stack>
  );
};

interface TemplateSelectParamFieldProps extends SimpleParamFieldProps {
  projectId: string;
}

const TemplateSelectParamField = ({ param, projectId, value, onChange, isDisabled }: TemplateSelectParamFieldProps) => {
  const { data: templates = [] } = useProjectTemplateAssets(projectId);
  const filtered = templates.filter((t) => (param.templateType ? t.templateType === param.templateType : true));
  const options = filtered.map((t) => ({ value: t.name, label: t.name }));
  const selected = value ?? param.defaultValue ?? "";
  const selectedLabel = options.find((o) => o.value === selected)?.label ?? (selected || "Select template...");

  return (
    <Stack gap="2xs">
      <Text textStyle="label/S/medium">{param.label}</Text>
      {param.description ? (
        <Text textStyle="paragraph/XS/regular" color="foreground.secondary">
          {param.description}
        </Text>
      ) : null}
      <Menu.Root>
        <Menu.Trigger asChild>
          <Button size="sm" variant="outline" width="full" justifyContent="space-between" disabled={isDisabled}>
            {selectedLabel}
            <Icon as={ChevronDown} color="fg.muted" />
          </Button>
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content bg="bg">
            {options.map((option) => (
              <MenuItem
                key={option.value}
                primaryLabel={option.label}
                isSelected={selected === option.value}
                onClick={() => onChange(option.value)}
              />
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
    </Stack>
  );
};
