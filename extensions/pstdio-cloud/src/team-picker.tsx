import type { TeamAccount } from "@pstdio/sdk/extensions";
import { SearchableMenu } from "@pstdio/ui";
import { Button } from "./button";
import { useCloudContext } from "./cloud-context";
import { CloudIcon } from "./cloud-label";

interface TeamPickerProps {
  teams: TeamAccount[];
  selected?: string;
  personal?: boolean;
  disabled?: boolean;
  onSelect: (accountId: string) => void;
}

export const TeamPicker = (props: TeamPickerProps) => {
  const { teams, selected, personal, disabled, onSelect } = props;
  const { t } = useCloudContext();
  const current = teams.find(({ accountId }) => accountId === selected);
  const choices = teams.map((team) => ({ id: team.accountId, label: team.name }));
  if (personal) choices.unshift({ id: "", label: t("teams.personal", "Personal") });
  return (
    <SearchableMenu
      trigger={
        <Button size="sm" variant="outline" disabled={disabled} aria-label={t("teams.choose", "Choose team")}>
          {current?.name ?? (personal ? t("teams.personal", "Personal") : t("teams.choose", "Choose team"))}
          <CloudIcon name="chevron-down" />
        </Button>
      }
      items={choices.map((choice) => ({
        ...choice,
        isSelected: choice.id === selected,
        onSelect: () => onSelect(choice.id),
      }))}
      searchPlaceholder={t("teams.search", "Search teams")}
      emptyState={t("teams.none", "No teams")}
    />
  );
};
