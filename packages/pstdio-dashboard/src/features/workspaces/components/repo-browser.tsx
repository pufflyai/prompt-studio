import { Box, Button, HStack, Menu, Text } from "@chakra-ui/react";
import { MenuItem, Tooltip } from "@pstdio/ui";
import { ChevronDown, FolderGit2, GitBranch, Repeat } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export interface WorkspacePanelMenuOption {
  label: string;
  value: string;
  icon?: React.ComponentType<{ size?: number }>;
}

export const getSelectedLabel = (
  options: WorkspacePanelMenuOption[],
  selectedValue: string,
  selectLabel: string,
  noneLabel: string,
) => {
  const selectedOption = options.find((option) => option.value === selectedValue);

  if (selectedOption) {
    return selectedOption.label;
  }

  if (options.length > 0) {
    return selectLabel;
  }

  return noneLabel;
};

interface RepoBrowserProps {
  repositoryOptions: WorkspacePanelMenuOption[];
  selectedRepository: string;
  onSelectRepository: (repository: string) => void;
  branchOptions: WorkspacePanelMenuOption[];
  selectedBranch: string;
  onSelectBranch: (branch: string) => void;
  isDisabled?: boolean;
  isRepoSwitchDisabled?: boolean;
  isReposLoading?: boolean;
  isBranchesLoading?: boolean;
}

export const RepoBrowser = (props: RepoBrowserProps) => {
  const {
    repositoryOptions,
    selectedRepository,
    onSelectRepository,
    branchOptions,
    selectedBranch,
    onSelectBranch,
    isDisabled = false,
    isRepoSwitchDisabled = false,
    isReposLoading = false,
    isBranchesLoading = false,
  } = props;
  const { t } = useTranslation("projects");

  const selectedRepositoryLabel = isReposLoading
    ? t("chatInput.repo.loading")
    : getSelectedLabel(
        repositoryOptions,
        selectedRepository,
        t("chatInput.repo.selectLabel"),
        t("chatInput.repo.none"),
      );

  const selectedBranchLabel = isBranchesLoading
    ? t("chatInput.branch.loading")
    : getSelectedLabel(branchOptions, selectedBranch, t("chatInput.branch.selectLabel"), t("chatInput.branch.none"));

  const isSwitchDisabled = isDisabled || isRepoSwitchDisabled || repositoryOptions.length <= 1;
  const isMenuDisabled = isDisabled || (repositoryOptions.length === 0 && branchOptions.length === 0);
  const defaultMenuContent = branchOptions.length > 0 ? "branches" : "repos";
  const [menuContent, setMenuContent] = useState<"branches" | "repos">(defaultMenuContent);
  const [open, setOpen] = useState(false);
  const isShowingRepos = menuContent === "repos";

  const handleOpenChange = (details: { open: boolean }) => {
    setOpen(details.open);
    if (details.open) {
      setMenuContent(defaultMenuContent);
    }
  };

  return (
    <Menu.Root lazyMount={false} open={open} onOpenChange={handleOpenChange} closeOnSelect={false}>
      <Menu.Trigger asChild>
        <Box>
          <Tooltip content={isMenuDisabled ? t("chatInput.branch.noneAvailable") : t("chatInput.branch.selectLabel")}>
            <Button
              variant="ghost"
              size="sm"
              px="2"
              aria-label={t("chatInput.branch.selectLabel")}
              disabled={isMenuDisabled}
            >
              <GitBranch size={14} data-testid="workspace-panel-menu-branch-icon" />
              <Text textStyle="label/XS/medium" color="fg" ml="2xs">
                {selectedBranchLabel}
              </Text>
              <ChevronDown size={14} />
            </Button>
          </Tooltip>
        </Box>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="260px" bg="bg" p="0">
          <HStack justify="space-between" alignItems="center" px="sm" py="xs" gap="xs">
            <HStack gap="xs" minW="0" color="fg.muted">
              <FolderGit2 size={14} />
              <Text textStyle="label/XS/medium" lineClamp={1}>
                {selectedRepositoryLabel}
              </Text>
            </HStack>
            <Tooltip content={t("chatInput.repo.selectLabel")}>
              <Button
                variant="ghost"
                size="xs"
                minW="1.5rem"
                h="1.5rem"
                px="1"
                aria-label={t("chatInput.repo.selectLabel")}
                disabled={isSwitchDisabled}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setMenuContent((current) => (current === "branches" ? "repos" : "branches"));
                }}
              >
                <Repeat size={14} />
              </Button>
            </Tooltip>
          </HStack>
          <Menu.Separator margin="0" />
          <Box
            maxH="18rem"
            overflowY="auto"
            py="1"
            data-testid={isShowingRepos ? "workspace-repo-options" : "workspace-repo-branch-options"}
          >
            {isShowingRepos ? (
              isReposLoading ? (
                <MenuItem primaryLabel={t("chatInput.repo.loading")} leftIcon={FolderGit2} isDisabled />
              ) : repositoryOptions.length > 0 ? (
                repositoryOptions.map((option) => (
                  <MenuItem
                    key={option.value}
                    id={option.value}
                    primaryLabel={option.label}
                    leftIcon={option.icon ?? FolderGit2}
                    isSelected={option.value === selectedRepository}
                    onClick={() => {
                      onSelectRepository(option.value);
                      setMenuContent("branches");
                    }}
                  />
                ))
              ) : (
                <MenuItem primaryLabel={t("chatInput.repo.noneLinked")} leftIcon={FolderGit2} isDisabled />
              )
            ) : isBranchesLoading ? (
              <MenuItem primaryLabel={t("chatInput.branch.loading")} leftIcon={GitBranch} isDisabled />
            ) : branchOptions.length > 0 ? (
              branchOptions.map((option) => (
                <MenuItem
                  key={option.value}
                  id={option.value}
                  primaryLabel={option.label}
                  leftIcon={option.icon ?? GitBranch}
                  isSelected={option.value === selectedBranch}
                  onClick={() => {
                    onSelectBranch(option.value);
                    setOpen(false);
                  }}
                />
              ))
            ) : (
              <MenuItem primaryLabel={t("chatInput.branch.noneAvailable")} leftIcon={GitBranch} isDisabled />
            )}
          </Box>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};
