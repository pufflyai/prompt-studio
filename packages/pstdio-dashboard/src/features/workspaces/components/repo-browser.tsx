import { Box, Button, Text } from "@chakra-ui/react";
import { MenuItem, SearchableMenu, type SearchableMenuItem, Tooltip } from "@pstdio/ui";
import { ChevronDown, FolderGit2, GitBranch } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface WorkspacePanelMenuOption {
  label: string;
  value: string;
  icon?: React.ComponentType<{ size?: number }>;
}

type ProjectsTranslate = (key: string) => string;

interface RepoBrowserProps {
  repositoryOptions: WorkspacePanelMenuOption[];
  selectedRepository: string;
  onSelectRepository: (repository: string) => void;
  branchOptions: WorkspacePanelMenuOption[];
  selectedBranch: string;
  onSelectBranch: (branch: string) => void;
  isDisabled?: boolean;
  isReposLoading?: boolean;
  isBranchesLoading?: boolean;
}

interface RepoBrowserMenuItem extends SearchableMenuItem {
  icon: NonNullable<WorkspacePanelMenuOption["icon"]>;
}

const getSelectedLabel = (
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

const getSelectedRepositoryLabel = (
  t: ProjectsTranslate,
  repositoryOptions: WorkspacePanelMenuOption[],
  selectedRepository: string,
  isReposLoading: boolean,
) => {
  if (isReposLoading) {
    return t("chatInput.repo.loading");
  }

  return getSelectedLabel(
    repositoryOptions,
    selectedRepository,
    t("chatInput.repo.selectLabel"),
    t("chatInput.repo.none"),
  );
};

const getSelectedBranchLabel = (
  t: ProjectsTranslate,
  branchOptions: WorkspacePanelMenuOption[],
  selectedBranch: string,
  isBranchesLoading: boolean,
) => {
  if (isBranchesLoading) {
    return t("chatInput.branch.loading");
  }

  return getSelectedLabel(branchOptions, selectedBranch, t("chatInput.branch.selectLabel"), t("chatInput.branch.none"));
};

const buildRepositoryMenuItems = (
  repositoryOptions: WorkspacePanelMenuOption[],
  selectedRepository: string,
  isReposLoading: boolean,
  t: ProjectsTranslate,
) => {
  if (isReposLoading) {
    const loadingItems: RepoBrowserMenuItem[] = [
      { id: "repo-loading", label: t("chatInput.repo.loading"), icon: FolderGit2, isDisabled: true },
    ];
    return loadingItems;
  }

  if (repositoryOptions.length === 0) {
    const emptyItems: RepoBrowserMenuItem[] = [
      { id: "repo-none-linked", label: t("chatInput.repo.noneLinked"), icon: FolderGit2, isDisabled: true },
    ];
    return emptyItems;
  }

  const optionItems: RepoBrowserMenuItem[] = repositoryOptions.map((option) => ({
    id: option.value,
    label: option.label,
    searchText: option.value,
    icon: option.icon ?? FolderGit2,
    isSelected: option.value === selectedRepository,
  }));

  return optionItems;
};

const buildBranchMenuItems = (
  branchOptions: WorkspacePanelMenuOption[],
  selectedBranch: string,
  isBranchesLoading: boolean,
  onSelectBranch: (branch: string) => void,
  t: ProjectsTranslate,
) => {
  if (isBranchesLoading) {
    const loadingItems: RepoBrowserMenuItem[] = [
      { id: "branch-loading", label: t("chatInput.branch.loading"), icon: GitBranch, isDisabled: true },
    ];
    return loadingItems;
  }

  if (branchOptions.length === 0) {
    const emptyItems: RepoBrowserMenuItem[] = [
      { id: "branch-none-available", label: t("chatInput.branch.noneAvailable"), icon: GitBranch, isDisabled: true },
    ];
    return emptyItems;
  }

  const optionItems: RepoBrowserMenuItem[] = branchOptions.map((option) => ({
    id: option.value,
    label: option.label,
    searchText: option.value,
    icon: option.icon ?? GitBranch,
    isSelected: option.value === selectedBranch,
    onSelect: () => onSelectBranch(option.value),
  }));

  return optionItems;
};

export const RepoBrowser = (props: RepoBrowserProps) => {
  const {
    repositoryOptions,
    selectedRepository,
    onSelectRepository,
    branchOptions,
    selectedBranch,
    onSelectBranch,
    isDisabled = false,
    isReposLoading = false,
    isBranchesLoading = false,
  } = props;
  const { t } = useTranslation("projects");

  const selectedRepositoryLabel = getSelectedRepositoryLabel(t, repositoryOptions, selectedRepository, isReposLoading);
  const selectedBranchLabel = getSelectedBranchLabel(t, branchOptions, selectedBranch, isBranchesLoading);
  const isMenuDisabled = isDisabled || (repositoryOptions.length === 0 && branchOptions.length === 0);
  const repositoryMenuItems = buildRepositoryMenuItems(repositoryOptions, selectedRepository, isReposLoading, t);
  const branchMenuItems = buildBranchMenuItems(branchOptions, selectedBranch, isBranchesLoading, onSelectBranch, t);

  return (
    <SearchableMenu
      trigger={
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
      }
      items={branchMenuItems}
      width="260px"
      showSearch={branchOptions.length > 10}
      searchPlaceholder={t("chatInput.branch.searchPlaceholder")}
      contentTestId="workspace-repo-branch-options"
      emptyState={<MenuItem primaryLabel={t("chatInput.branch.noSearchResults")} leftIcon={GitBranch} isDisabled />}
      parentList={{
        items: repositoryMenuItems,
        selectedLabel: selectedRepositoryLabel,
        selectedIcon: FolderGit2,
        ariaLabel: t("chatInput.repo.selectLabel"),
        disabled: isDisabled || repositoryOptions.length <= 1,
        showSearch: false,
        contentTestId: "workspace-repo-options",
        emptyState: <MenuItem primaryLabel={t("chatInput.repo.noSearchResults")} leftIcon={FolderGit2} isDisabled />,
        onSelect: (item) => onSelectRepository(item.id),
      }}
    />
  );
};
