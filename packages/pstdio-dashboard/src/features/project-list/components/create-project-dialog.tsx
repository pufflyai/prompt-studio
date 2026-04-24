import {
  Button,
  Icon as ChakraIcon,
  CloseButton,
  Dialog,
  IconButton,
  Input,
  Menu,
  Stack,
  Text,
} from "@chakra-ui/react";
import { MenuItem } from "@pstdio/ui";
import { FolderOpen, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderPickerDialog } from "@/features/file-system/components/folder-picker-dialog";
import type { CreateProjectInput } from "../data/api";

interface CreateProjectDialogProps {
  open: boolean;
  availableAgents: { id: string; name: string }[];
  isSubmitting?: boolean;
  onClose: () => void;
  onCreate: (input: CreateProjectInput) => void;
}

interface DraftRepository {
  path: string;
  name: string;
  displayName: string | null;
}

type ProjectBasicsInput = {
  name: string;
  repositories: DraftRepository[];
};

export const hasProjectBasicsErrors = (input: ProjectBasicsInput) => {
  return input.name.trim().length === 0 || input.repositories.length === 0;
};

export const resolveInitialSelectedAgentIds = (availableAgents: { id: string }[]) => {
  return availableAgents.map((agent) => agent.id);
};

export const toggleAgentSelection = (selectedAgentIds: string[], agentId: string) => {
  return selectedAgentIds.includes(agentId)
    ? selectedAgentIds.filter((id) => id !== agentId)
    : [...selectedAgentIds, agentId];
};

export const canSubmitAgentSelection = (selectedAgentIds: string[]) => {
  return selectedAgentIds.length > 0;
};

const resolveRepoName = (path: string) => {
  const normalizedPath = path.replaceAll("\\", "/").replace(/\/+$/g, "");
  const segments = normalizedPath.split("/").filter(Boolean);
  return segments.at(-1) ?? "repo";
};

export const CreateProjectDialog = (props: CreateProjectDialogProps) => {
  const { open, availableAgents, isSubmitting = false, onClose, onCreate } = props;
  const { t } = useTranslation(["projects", "common"]);
  const [name, setName] = useState("");
  const [repositories, setRepositories] = useState<DraftRepository[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [isRepoPickerOpen, setRepoPickerOpen] = useState(false);
  const [repoError, setRepoError] = useState("");
  const [touched, setTouched] = useState(false);
  const [agentsTouched, setAgentsTouched] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setRepositories([]);
      setSelectedAgentIds([]);
      setStep(1);
      setRepoPickerOpen(false);
      setRepoError("");
      setTouched(false);
      setAgentsTouched(false);
      return;
    }

    setSelectedAgentIds(resolveInitialSelectedAgentIds(availableAgents));
  }, [open, availableAgents]);

  const trimmedName = name.trim();
  const hasNameError = touched && trimmedName.length === 0;
  const hasRepoError = touched && repositories.length === 0;
  const hasAgentError = agentsTouched && selectedAgentIds.length === 0;
  const isWorking = isSubmitting;

  const handleNext = () => {
    setTouched(true);

    if (hasProjectBasicsErrors({ name, repositories })) {
      return;
    }

    setStep(2);
  };

  const handleSubmit = () => {
    setAgentsTouched(true);

    if (!canSubmitAgentSelection(selectedAgentIds)) {
      return;
    }

    onCreate({
      name: trimmedName,
      repositories: repositories.map((repo) => ({
        path: repo.path,
        displayName: repo.displayName ?? null,
      })),
      agents: selectedAgentIds,
    });
  };

  const handleAgentToggle = (agentId: string) => {
    setSelectedAgentIds((current) => toggleAgentSelection(current, agentId));
  };

  const handleRepoSelected = (path: string | null) => {
    if (!path) {
      setRepoPickerOpen(false);
      return;
    }

    const trimmedPath = path.trim();
    if (!trimmedPath) {
      setRepoError(t("createProjectDialog.repositories.errors.pathRequired"));
      return;
    }

    if (repositories.some((repo) => repo.path === trimmedPath)) {
      setRepoError(t("createProjectDialog.repositories.errors.alreadyAdded"));
      return;
    }

    setRepositories((current) => [
      ...current,
      {
        path: trimmedPath,
        name: resolveRepoName(trimmedPath),
        displayName: null,
      },
    ]);
    setRepoError("");
    setRepoPickerOpen(false);
  };

  const handleRemoveRepo = (path: string) => {
    setRepositories((current) => current.filter((repo) => repo.path !== path));
  };

  return (
    <>
      <Dialog.Root
        lazyMount
        unmountOnExit
        open={open}
        onOpenChange={(details) => !details.open && onClose()}
        closeOnInteractOutside={false}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Text textStyle="heading/M">{t("createProjectDialog.title")}</Text>
              <Dialog.CloseTrigger>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              {step === 1 ? (
                <Stack gap="md">
                  <Stack gap="xs">
                    <Text textStyle="label/XS/regular" color="fg.muted">
                      {t("createProjectDialog.projectName.label")}
                    </Text>
                    <Input
                      placeholder={t("createProjectDialog.projectName.placeholder")}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      disabled={isSubmitting}
                    />
                    {hasNameError ? (
                      <Text textStyle="label/XS/regular" color="red.500">
                        {t("createProjectDialog.projectName.required")}
                      </Text>
                    ) : null}
                  </Stack>

                  <Stack gap="xs">
                    <Text textStyle="label/XS/regular" color="fg.muted">
                      {t("createProjectDialog.repositories.label")}
                    </Text>
                    {repositories.length === 0 ? (
                      <Text textStyle="paragraph/S/regular" color="fg.muted">
                        {t("createProjectDialog.repositories.empty")}
                      </Text>
                    ) : (
                      <Stack gap="xs">
                        {repositories.map((repo) => (
                          <Stack key={repo.path} direction="row" gap="sm" align="center">
                            <Stack flex="1">
                              <Menu.Root>
                                <MenuItem
                                  primaryLabel={repo.displayName ?? repo.name}
                                  secondaryLabel={repo.path}
                                  leftIcon={FolderOpen}
                                  isDisabled
                                  width="100%"
                                  maxWidth="100%"
                                />
                              </Menu.Root>
                            </Stack>
                            <IconButton
                              aria-label={t("createProjectDialog.repositories.remove")}
                              size="xs"
                              variant="ghost"
                              onClick={() => handleRemoveRepo(repo.path)}
                              disabled={isWorking}
                            >
                              <ChakraIcon as={X} boxSize="16px" />
                            </IconButton>
                          </Stack>
                        ))}
                      </Stack>
                    )}
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        setRepoError("");
                        setRepoPickerOpen(true);
                      }}
                      disabled={isWorking}
                    >
                      {t("createProjectDialog.repositories.browse")}
                    </Button>
                    {repoError ? (
                      <Text textStyle="label/XS/regular" color="red.500">
                        {repoError}
                      </Text>
                    ) : null}
                    {hasRepoError ? (
                      <Text textStyle="label/XS/regular" color="red.500">
                        {t("createProjectDialog.repositories.selectOne")}
                      </Text>
                    ) : null}
                  </Stack>
                </Stack>
              ) : (
                <Stack gap="sm">
                  <Stack gap="2xs">
                    <Text textStyle="label/L/medium">{t("createProjectDialog.agents.title")}</Text>
                    <Text textStyle="paragraph/S/regular" color="fg.muted">
                      {t("createProjectDialog.agents.description")}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    {availableAgents.map((agent) => {
                      const checked = selectedAgentIds.includes(agent.id);

                      return (
                        <Stack
                          as="label"
                          key={agent.id}
                          direction="row"
                          gap="sm"
                          align="center"
                          borderWidth="1px"
                          borderRadius="md"
                          borderColor={checked ? "border.accent" : "border.muted"}
                          px="sm"
                          py="sm"
                          cursor="pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleAgentToggle(agent.id)}
                            disabled={isWorking}
                          />
                          <Stack gap="0" flex="1">
                            <Text textStyle="label/M/medium">{agent.name}</Text>
                            <Text textStyle="paragraph/XS/regular" color="fg.muted">
                              {agent.id}
                            </Text>
                          </Stack>
                        </Stack>
                      );
                    })}
                  </Stack>
                  {hasAgentError ? (
                    <Text textStyle="label/XS/regular" color="red.500">
                      {t("createProjectDialog.agents.selectAtLeastOne")}
                    </Text>
                  ) : null}
                </Stack>
              )}
            </Dialog.Body>
            <Dialog.Footer>
              <Stack direction="row" gap="1">
                {step === 1 ? (
                  <>
                    <Button onClick={onClose} variant="outline">
                      {t("common:buttons.cancel")}
                    </Button>
                    <Button onClick={handleNext} variant="primary">
                      {t("createProjectDialog.actions.next")}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={() => setStep(1)} variant="outline" disabled={isWorking}>
                      {t("createProjectDialog.actions.back")}
                    </Button>
                    <Button onClick={handleSubmit} loading={isSubmitting} variant="primary">
                      {t("createProjectDialog.actions.create")}
                    </Button>
                  </>
                )}
              </Stack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
      <FolderPickerDialog
        open={isRepoPickerOpen}
        title={t("createProjectDialog.folderPicker.title")}
        description={t("createProjectDialog.folderPicker.description")}
        onClose={() => setRepoPickerOpen(false)}
        onSelect={handleRepoSelected}
        selectedPaths={repositories.map((repo) => repo.path)}
      />
    </>
  );
};
