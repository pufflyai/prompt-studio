import { Box, Button, HStack, Input, InputGroup, Menu, Text } from "@chakra-ui/react";
import { MenuItem, Tooltip } from "@pstdio/ui";
import { ChevronDown, FolderGit2, GitBranch, Repeat, Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { filterMenuOptions } from "../utils/filter-menu-options";

export interface WorkspacePanelMenuOption {
  label: string;
  value: string;
  icon?: React.ComponentType<{ size?: number }>;
}

type MenuContent = "branches" | "repos";
type ProjectsTranslate = (key: string) => string;

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

interface RepoBrowserMenuOptionsProps {
  menuContent: MenuContent;
  repositoryOptions: WorkspacePanelMenuOption[];
  selectedRepository: string;
  filteredRepositoryOptions: WorkspacePanelMenuOption[];
  isReposLoading: boolean;
  branchOptions: WorkspacePanelMenuOption[];
  selectedBranch: string;
  filteredBranchOptions: WorkspacePanelMenuOption[];
  isBranchesLoading: boolean;
  onSelectRepository: (repoId: string) => void;
  onSelectBranch: (branch: string) => void;
  t: ProjectsTranslate;
}

const getSelectedRepositoryLabel = (
  t: ProjectsTranslate,
  repositoryOptions: WorkspacePanelMenuOption[],
  selectedRepository: string,
  isReposLoading: boolean,
) => {
  if (isReposLoading) return t("chatInput.repo.loading");
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
  if (isBranchesLoading) return t("chatInput.branch.loading");
  return getSelectedLabel(branchOptions, selectedBranch, t("chatInput.branch.selectLabel"), t("chatInput.branch.none"));
};

const getSearchPlaceholder = (menuContent: MenuContent, t: ProjectsTranslate) => {
  if (menuContent === "repos") return t("chatInput.repo.searchPlaceholder");
  return t("chatInput.branch.searchPlaceholder");
};

const shouldShowSearch = (
  menuContent: MenuContent,
  repositoryOptions: WorkspacePanelMenuOption[],
  branchOptions: WorkspacePanelMenuOption[],
) => {
  if (menuContent === "repos") return repositoryOptions.length > 10;
  return branchOptions.length > 10;
};

const RepoBrowserMenuOptions = (props: RepoBrowserMenuOptionsProps) => {
  const {
    menuContent,
    repositoryOptions,
    selectedRepository,
    filteredRepositoryOptions,
    isReposLoading,
    branchOptions,
    selectedBranch,
    filteredBranchOptions,
    isBranchesLoading,
    onSelectRepository,
    onSelectBranch,
    t,
  } = props;

  if (menuContent === "repos") {
    if (isReposLoading) {
      return <MenuItem primaryLabel={t("chatInput.repo.loading")} leftIcon={FolderGit2} isDisabled />;
    }

    if (filteredRepositoryOptions.length > 0) {
      return filteredRepositoryOptions.map((option) => (
        <MenuItem
          key={option.value}
          id={option.value}
          primaryLabel={option.label}
          leftIcon={option.icon ?? FolderGit2}
          isSelected={option.value === selectedRepository}
          onClick={() => onSelectRepository(option.value)}
        />
      ));
    }

    if (repositoryOptions.length > 0) {
      return <MenuItem primaryLabel={t("chatInput.repo.noSearchResults")} leftIcon={FolderGit2} isDisabled />;
    }

    return <MenuItem primaryLabel={t("chatInput.repo.noneLinked")} leftIcon={FolderGit2} isDisabled />;
  }

  if (isBranchesLoading) {
    return <MenuItem primaryLabel={t("chatInput.branch.loading")} leftIcon={GitBranch} isDisabled />;
  }

  if (filteredBranchOptions.length > 0) {
    return filteredBranchOptions.map((option) => (
      <MenuItem
        key={option.value}
        id={option.value}
        primaryLabel={option.label}
        leftIcon={option.icon ?? GitBranch}
        isSelected={option.value === selectedBranch}
        onClick={() => onSelectBranch(option.value)}
      />
    ));
  }

  if (branchOptions.length > 0) {
    return <MenuItem primaryLabel={t("chatInput.branch.noSearchResults")} leftIcon={GitBranch} isDisabled />;
  }

  return <MenuItem primaryLabel={t("chatInput.branch.noneAvailable")} leftIcon={GitBranch} isDisabled />;
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
  const [searchQuery, setSearchQuery] = useState("");
  const filteredRepositoryOptions = filterMenuOptions(repositoryOptions, searchQuery);
  const filteredBranchOptions = filterMenuOptions(branchOptions, searchQuery);
  const searchPlaceholder = getSearchPlaceholder(menuContent, t);
  const shouldShowSearchInput = shouldShowSearch(menuContent, repositoryOptions, branchOptions);

  const handleOpenChange = (details: { open: boolean }) => {
    setOpen(details.open);
    if (details.open) {
      setMenuContent(defaultMenuContent);
      setSearchQuery("");
    }
  };

  const handleSelectRepository = (value: string) => {
    onSelectRepository(value);
    setSearchQuery("");
    setMenuContent("branches");
  };

  const handleSelectBranch = (value: string) => {
    onSelectBranch(value);
    setSearchQuery("");
    setOpen(false);
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
        <Menu.Content w="260px" bg="bg" p="0">
          <HStack justify="space-between" alignItems="center" px="sm" py="xs" gap="xs">
            <HStack gap="xs" minW="0" color="fg.muted">
              <FolderGit2 size={14} />
              <Text textStyle="label/XS/medium" lineClamp={1}>
                {selectedRepositoryLabel}
              </Text>
            </HStack>
            {repositoryOptions.length > 1 && (
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
                    setSearchQuery("");
                    setMenuContent((current) => (current === "branches" ? "repos" : "branches"));
                  }}
                >
                  <Repeat size={14} />
                </Button>
              </Tooltip>
            )}
          </HStack>
          {shouldShowSearchInput ? (
            <InputGroup startElement={<Search size={14} />}>
              <Input
                borderRight={0}
                borderLeft={0}
                borderRadius="0"
                value={searchQuery}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  event.stopPropagation();
                }}
              />
            </InputGroup>
          ) : (
            <Menu.Separator margin="0" />
          )}
          <Box
            maxH="18rem"
            overflowY="auto"
            data-testid={menuContent === "repos" ? "workspace-repo-options" : "workspace-repo-branch-options"}
          >
            <RepoBrowserMenuOptions
              menuContent={menuContent}
              repositoryOptions={repositoryOptions}
              selectedRepository={selectedRepository}
              filteredRepositoryOptions={filteredRepositoryOptions}
              isReposLoading={isReposLoading}
              branchOptions={branchOptions}
              selectedBranch={selectedBranch}
              filteredBranchOptions={filteredBranchOptions}
              isBranchesLoading={isBranchesLoading}
              onSelectRepository={handleSelectRepository}
              onSelectBranch={handleSelectBranch}
              t={t}
            />
          </Box>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};
