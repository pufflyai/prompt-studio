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

  const isMenuDisabled = isDisabled || (repositoryOptions.length === 0 && branchOptions.length === 0);
  const defaultMenuContent = branchOptions.length > 0 ? "branches" : "repos";
  const [menuContent, setMenuContent] = useState<"branches" | "repos">(defaultMenuContent);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const isShowingRepos = menuContent === "repos";
  const filteredRepositoryOptions = filterMenuOptions(repositoryOptions, searchQuery);
  const filteredBranchOptions = filterMenuOptions(branchOptions, searchQuery);

  const searchPlaceholder = isShowingRepos
    ? t("chatInput.repo.searchPlaceholder")
    : t("chatInput.branch.searchPlaceholder");
  const shouldShowSearchInput = isShowingRepos ? repositoryOptions.length > 10 : branchOptions.length > 10;

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
            data-testid={isShowingRepos ? "workspace-repo-options" : "workspace-repo-branch-options"}
          >
            {isShowingRepos ? (
              isReposLoading ? (
                <MenuItem primaryLabel={t("chatInput.repo.loading")} leftIcon={FolderGit2} isDisabled />
              ) : filteredRepositoryOptions.length > 0 ? (
                filteredRepositoryOptions.map((option) => (
                  <MenuItem
                    key={option.value}
                    id={option.value}
                    primaryLabel={option.label}
                    leftIcon={option.icon ?? FolderGit2}
                    isSelected={option.value === selectedRepository}
                    onClick={() => handleSelectRepository(option.value)}
                  />
                ))
              ) : repositoryOptions.length > 0 ? (
                <MenuItem primaryLabel={t("chatInput.repo.noSearchResults")} leftIcon={FolderGit2} isDisabled />
              ) : (
                <MenuItem primaryLabel={t("chatInput.repo.noneLinked")} leftIcon={FolderGit2} isDisabled />
              )
            ) : isBranchesLoading ? (
              <MenuItem primaryLabel={t("chatInput.branch.loading")} leftIcon={GitBranch} isDisabled />
            ) : filteredBranchOptions.length > 0 ? (
              filteredBranchOptions.map((option) => (
                <MenuItem
                  key={option.value}
                  id={option.value}
                  primaryLabel={option.label}
                  leftIcon={option.icon ?? GitBranch}
                  isSelected={option.value === selectedBranch}
                  onClick={() => handleSelectBranch(option.value)}
                />
              ))
            ) : branchOptions.length > 0 ? (
              <MenuItem primaryLabel={t("chatInput.branch.noSearchResults")} leftIcon={GitBranch} isDisabled />
            ) : (
              <MenuItem primaryLabel={t("chatInput.branch.noneAvailable")} leftIcon={GitBranch} isDisabled />
            )}
          </Box>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};
