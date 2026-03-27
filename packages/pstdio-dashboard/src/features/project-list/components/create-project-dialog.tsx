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
  isSubmitting?: boolean;
  onClose: () => void;
  onCreate: (input: CreateProjectInput) => void;
}

interface DraftRepository {
  path: string;
  name: string;
  displayName: string | null;
}

const resolveRepoName = (path: string) => {
  const normalizedPath = path.replaceAll("\\", "/").replace(/\/+$/g, "");
  const segments = normalizedPath.split("/").filter(Boolean);
  return segments.at(-1) ?? "repo";
};

export const CreateProjectDialog = (props: CreateProjectDialogProps) => {
  const { open, isSubmitting = false, onClose, onCreate } = props;
  const { t } = useTranslation(["projects", "common"]);
  const [name, setName] = useState("");
  const [repositories, setRepositories] = useState<DraftRepository[]>([]);
  const [isRepoPickerOpen, setRepoPickerOpen] = useState(false);
  const [repoError, setRepoError] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setRepositories([]);
      setRepoPickerOpen(false);
      setRepoError("");
      setTouched(false);
    }
  }, [open]);

  const trimmedName = name.trim();
  const hasNameError = touched && trimmedName.length === 0;
  const hasRepoError = touched && repositories.length === 0;
  const isWorking = isSubmitting;

  const handleSubmit = () => {
    setTouched(true);

    if (!trimmedName || repositories.length === 0) {
      return;
    }

    onCreate({
      name: trimmedName,
      repositories: repositories.map((repo) => ({
        path: repo.path,
        displayName: repo.displayName ?? null,
      })),
    });
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
            </Dialog.Body>
            <Dialog.Footer>
              <Stack direction="row" gap="1">
                <Button onClick={onClose} variant="outline">
                  {t("common:buttons.cancel")}
                </Button>
                <Button onClick={handleSubmit} loading={isSubmitting} variant="solid">
                  {t("createProjectDialog.actions.create")}
                </Button>
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
