import { HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { Checkbox, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { extensions, harnessChoices, workChoices } from "./catalog";
import { ExtensionIcon } from "./extension-icon";
import { type OnboardingHarness, type OnboardingWorkArea, onboardingExtensions } from "./types";

interface ChoiceCardProps {
  label: string;
  icon: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}
const ChoiceCard = (props: ChoiceCardProps) => {
  const { label, icon, checked, disabled, onChange } = props;
  return (
    <SimpleCard variant="action">
      <SimpleCardBody asChild>
        <Checkbox
          size="sm"
          w="full"
          alignItems="center"
          gap="xs"
          checked={checked}
          disabled={disabled}
          onCheckedChange={({ checked }) => onChange(checked === true)}
          inputProps={{ "aria-label": label }}
        >
          <HStack gap="xs" minW="0">
            {icon}
            <Text textStyle="label/M/regular" whiteSpace="nowrap">
              {label}
            </Text>
          </HStack>
        </Checkbox>
      </SimpleCardBody>
    </SimpleCard>
  );
};
const toggle = <T extends string>(selected: T[], id: T, checked: boolean) =>
  checked ? [...selected, id] : selected.filter((value) => value !== id);

interface HarnessChoicesProps {
  icons?: Partial<Record<OnboardingHarness, string>>;
  selected: OnboardingHarness[];
  detected: OnboardingHarness[];
  platform: string;
  installed: string[];
  disabled?: boolean;
  onChange: (selected: OnboardingHarness[]) => void;
}
export const HarnessChoices = (props: HarnessChoicesProps) => {
  const { selected, detected, installed, platform, disabled, onChange, icons = {} } = props;
  const { t } = useTranslation("common");
  return (
    <Stack gap="lg">
      {[true, false].map((existing) => {
        const choices = harnessChoices.filter(
          ({ id }) => (detected.includes(id) || installed.includes(`pstdio.harness-${id}`)) === existing,
        );
        if (!choices.length) return null;
        let label = t("onboarding.onThisDevice");
        if (platform === "darwin") label = t("onboarding.onThisMac");
        if (!existing) label = t("onboarding.available");
        return (
          <Stack key={String(existing)} gap="xs" role="group" aria-label={label}>
            <Text textStyle="label/S/medium" color="fg.muted">
              {label}
            </Text>
            {choices.map((choice) => (
              <ChoiceCard
                key={choice.id}
                label={choice.name}
                icon={<ExtensionIcon name={icons[choice.id]} />}
                checked={selected.includes(choice.id)}
                disabled={disabled}
                onChange={(checked) => onChange(toggle(selected, choice.id, checked))}
              />
            ))}
          </Stack>
        );
      })}
    </Stack>
  );
};

export const WorkChoices = (props: {
  choices?: typeof extensions;
  selected: OnboardingWorkArea[];
  installed: string[];
  disabled?: boolean;
  onChange: (selected: OnboardingWorkArea[]) => void;
}) => {
  const { selected, installed, disabled, onChange, choices = extensions } = props;
  const { t } = useTranslation("common");
  const names = [
    ...new Set([
      ...Object.keys(choices).filter((name) => installed.includes(`pstdio.${name}`)),
      ...onboardingExtensions(selected),
    ]),
  ];
  return (
    <Stack gap="xl">
      <Stack gap="xs" role="group" aria-label={t("onboarding.workAreas")}>
        {workChoices.map((choice) => (
          <ChoiceCard
            key={choice.id}
            label={t(`onboarding.${choice.key}`)}
            icon={
              <Icon boxSize="icon-xs" color="fg.muted">
                <choice.icon />
              </Icon>
            }
            checked={selected.includes(choice.id)}
            disabled={disabled}
            onChange={(checked) => onChange(toggle(selected, choice.id, checked))}
          />
        ))}
      </Stack>
      <Stack gap="xs" role="region" aria-label={t("onboarding.extensions")}>
        {[true, false].map((existing) => {
          const group = names.filter((name) => installed.includes(`pstdio.${name}`) === existing);
          if (!group.length) return null;
          return (
            <Stack key={String(existing)} gap="xs">
              <Text textStyle="label/S/medium" color="fg.muted">
                {t(existing ? "onboarding.installed" : "onboarding.extensions")}
              </Text>
              <SimpleCard>
                <SimpleCardBody>
                  <Stack gap="xs">
                    {group.map((name) => {
                      const entry = choices[name];
                      return (
                        <HStack key={name} gap="xs">
                          <ExtensionIcon name={entry.icon} size="xs" />
                          <Text textStyle="label/S/regular">{entry.name}</Text>
                        </HStack>
                      );
                    })}
                  </Stack>
                </SimpleCardBody>
              </SimpleCard>
            </Stack>
          );
        })}
      </Stack>
    </Stack>
  );
};
