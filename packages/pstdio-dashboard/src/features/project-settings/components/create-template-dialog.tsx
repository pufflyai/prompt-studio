import { Button, CloseButton, Dialog, Input, Menu, Stack, Text } from "@chakra-ui/react";
import { MenuItem, toaster } from "@pstdio/ui";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { ProjectTemplateAssetType } from "@/features/project/types";
import { useCreateProjectTemplate } from "../hooks/use-templates";

const TEMPLATE_TYPES: { value: ProjectTemplateAssetType; label: string }[] = [
  { value: "prompt", label: "Prompt" },
  { value: "ticket", label: "Ticket" },
  { value: "document", label: "Document" },
];

interface CreateTemplateDialogProps {
  projectId: string | undefined;
  open: boolean;
  onClose: () => void;
  onCreated: (name: string) => void;
}

export const CreateTemplateDialog = (props: CreateTemplateDialogProps) => {
  const { projectId, open, onClose, onCreated } = props;
  const createTemplate = useCreateProjectTemplate(projectId);
  const [name, setName] = useState("");
  const [templateType, setTemplateType] = useState<ProjectTemplateAssetType>("prompt");

  const selectedLabel = TEMPLATE_TYPES.find((t) => t.value === templateType)?.label ?? "Prompt";

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    try {
      await createTemplate.mutateAsync({
        name: trimmedName,
        templateType,
        content: "",
      });
      onCreated(trimmedName);
      setName("");
      setTemplateType("prompt");
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create template.";
      toaster.create({ type: "error", title: "Create template failed", description: message });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && name.trim()) handleCreate();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Text textStyle="heading/M">Create template</Text>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap="md">
              <Stack gap="xs">
                <Text textStyle="label/S/medium">Name</Text>
                <Input
                  size="sm"
                  placeholder="Template name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                />
              </Stack>
              <Stack gap="xs">
                <Text textStyle="label/S/medium">Type</Text>
                <Menu.Root>
                  <Menu.Trigger asChild>
                    <Button size="sm" variant="outline" width="full" justifyContent="space-between">
                      {selectedLabel}
                      <ChevronDown size={16} />
                    </Button>
                  </Menu.Trigger>
                  <Menu.Positioner>
                    <Menu.Content minW="200px" bg="bg">
                      {TEMPLATE_TYPES.map((type) => (
                        <MenuItem
                          key={type.value}
                          id={type.value}
                          primaryLabel={type.label}
                          isSelected={type.value === templateType}
                          onClick={() => setTemplateType(type.value)}
                        />
                      ))}
                    </Menu.Content>
                  </Menu.Positioner>
                </Menu.Root>
              </Stack>
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <Stack direction="row" gap="1">
              <Button onClick={onClose}>Cancel</Button>
              <Button
                variant="solid"
                colorPalette="blue"
                onClick={handleCreate}
                loading={createTemplate.isPending}
                disabled={!name.trim()}
              >
                Create
              </Button>
            </Stack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
