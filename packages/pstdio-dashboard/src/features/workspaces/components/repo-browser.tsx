import { Box, Button, HStack, Text } from "@chakra-ui/react";
import { MenuItem, SearchableMenu, type SearchableMenuItem, Tooltip } from "@pstdio/ui";
import { ChevronDown, FolderGit2, GitBranch, Repeat } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export interface WorkspacePanelMenuOption {
  label: string;
  value: string;
  icon?: React.ComponentType<{ size?: number }>;
}

type MenuContent = "branches" | "repos";
type ProjectsTranslate = (key: string) => string;

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

interface RepoBrowserMenuItem extends SearchableMenuItem {
  icon: NonNullable<WorkspacePanelMenuOption["icon"]>;
  isDisabled?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
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

const getSearchPlaceholder = (menuContent: MenuContent, t: ProjectsTranslate) => {
  if (menuContent === "repos") {
    return t("chatInput.repo.searchPlaceholder");
  }

  return t("chatInput.branch.searchPlaceholder");
};

const shouldShowSearch = (
  menuContent: MenuContent,
  repositoryOptions: WorkspacePanelMenuOption[],
  branchOptions: WorkspacePanelMenuOption[],
) => {
  if (menuContent === "repos") {
    return repositoryOptions.length > 10;
  }

  return branchOptions.length > 10;
};

const buildRepositoryMenuItems = (
  repositoryOptions: WorkspacePanelMenuOption[],
  selectedRepository: string,
  isReposLoading: boolean,
  onSelectRepository: (repoId: string) => void,
  t: ProjectsTranslate,
) => {
  if (isReposLoading) {
    const loadingItems: RepoBrowserMenuItem[] = [
      {
        id: "repo-loading",
        label: t("chatInput.repo.loading"),
        icon: FolderGit2,
        isDisabled: true,
      },
    ];

    return loadingItems;
  }

  if (repositoryOptions.length === 0) {
    const emptyItems: RepoBrowserMenuItem[] = [
      {
        id: "repo-none-linked",
        label: t("chatInput.repo.noneLinked"),
        icon: FolderGit2,
        isDisabled: true,
      },
    ];

    return emptyItems;
  }

  const optionItems: RepoBrowserMenuItem[] = repositoryOptions.map((option) => ({
    id: option.value,
    label: option.label,
    searchText: option.value,
    icon: option.icon ?? FolderGit2,
    isSelected: option.value === selectedRepository,
    onSelect: () => onSelectRepository(option.value),
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
      {
        id: "branch-loading",
        label: t("chatInput.branch.loading"),
        icon: GitBranch,
        isDisabled: true,
      },
    ];

    return loadingItems;
  }

  if (branchOptions.length === 0) {
    const emptyItems: RepoBrowserMenuItem[] = [
      {
        id: "branch-none-available",
        label: t("chatInput.branch.noneAvailable"),
        icon: GitBranch,
        isDisabled: true,
      },
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
  const defaultMenuContent: MenuContent = branchOptions.length > 0 ? "branches" : "repos";
  const [menuContent, setMenuContent] = useState<MenuContent>(defaultMenuContent);
  const [open, setOpen] = useState(false);
  const repositoryMenuItems = buildRepositoryMenuItems(
    repositoryOptions,
    selectedRepository,
    isReposLoading,
    (repoId) => {
      onSelectRepository(repoId);
      setMenuContent("branches");
    },
    t,
  );
  const branchMenuItems = buildBranchMenuItems(
    branchOptions,
    selectedBranch,
    isBranchesLoading,
    (branch) => {
      onSelectBranch(branch);
      setOpen(false);
    },
    t,
  );
  const menuItems = menuContent === "repos" ? repositoryMenuItems : branchMenuItems;
  const menuIcon = menuContent === "repos" ? FolderGit2 : GitBranch;
  const emptyLabel =
    menuContent === "repos" ? t("chatInput.repo.noSearchResults") : t("chatInput.branch.noSearchResults");
  const contentTestId = menuContent === "repos" ? "workspace-repo-options" : "workspace-repo-branch-options";

  const handleOpenChange = (details: { open: boolean }) => {
    setOpen(details.open);

    if (details.open) {
      setMenuContent(defaultMenuContent);
    }
  };

  return (
    <SearchableMenu
      lazyMount={false}
      closeOnSelect={false}
      open={open}
      onOpenChange={handleOpenChange}
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
      items={menuItems}
      width="260px"
      showSearch={shouldShowSearch(menuContent, repositoryOptions, branchOptions)}
      searchPlaceholder={getSearchPlaceholder(menuContent, t)}
      header={
        <HStack justify="space-between" alignItems="center" px="sm" py="xs" gap="xs">
          <HStack gap="xs" minW="0" color="fg.muted">
            <FolderGit2 size={14} />
            <Text textStyle="label/XS/medium" lineClamp={1}>
              {selectedRepositoryLabel}
            </Text>
          </HStack>
          {repositoryOptions.length > 1 ? (
            <Tooltip content={t("chatInput.repo.selectLabel")}>
              <Button
                variant="ghost"
                size="xs"
                minW="1.5rem"
                h="1.5rem"
                px="1"
                aria-label={t("chatInput.repo.selectLabel")}
                disabled={isDisabled}
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
          ) : null}
        </HStack>
      }
      contentTestId={contentTestId}
      emptyState={<MenuItem primaryLabel={emptyLabel} leftIcon={menuIcon} isDisabled />}
      renderItem={(item) => (
        <MenuItem
          id={item.id}
          primaryLabel={item.label}
          leftIcon={item.icon}
          isDisabled={item.isDisabled}
          isSelected={item.isSelected}
          onClick={item.onSelect}
        />
      )}
    />
  );
};
