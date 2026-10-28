import { HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { Checkbox, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { type OnboardingHarness, type OnboardingWorkArea, onboardingExtensions } from "pstdio-api-contracts";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { extensions, harnessChoices, workChoices } from "./catalog";

interface ChoiceCardProps {
  label: string;
  icon: ComponentType;
  checked: boolean;
  onChange: (checked: boolean) => void;
}
const ChoiceCard = (props: ChoiceCardProps) => {
  const { label, icon: ChoiceIcon, checked, onChange } = props;
  return (
    <SimpleCard variant="action">
      <SimpleCardBody asChild>
        <Checkbox
          size="sm"
          w="full"
          alignItems="center"
          gap="xs"
          checked={checked}
          onCheckedChange={({ checked }) => onChange(checked === true)}
          inputProps={{ "aria-label": label }}
        >
          <HStack gap="xs" minW="0">
            <Icon boxSize="icon-xs" color="fg.muted" flexShrink="0">
              <ChoiceIcon />
            </Icon>
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
  selected: OnboardingHarness[];
  detected: OnboardingHarness[];
  platform: string;
  onChange: (selected: OnboardingHarness[]) => void;
}
export const HarnessChoices = (props: HarnessChoicesProps) => {
  const { selected, detected, platform, onChange } = props;
  const { t } = useTranslation("common");
  return (
    <Stack gap="lg">
      {[true, false].map((existing) => {
        const choices = harnessChoices.filter(({ id }) => detected.includes(id) === existing);
        if (!choices.length) return null;
        let label = t("onboarding.onThisDevice");
        if (platform === "darwin") label = t("onboarding.onThisMac");
        if (!existing) label = t("onboarding.available");
        return (
          <Stack key={String(existing)} gap="xs">
            <Text textStyle="label/S/medium" color="fg.muted">
              {label}
            </Text>
            {choices.map((choice) => (
              <ChoiceCard
                key={choice.id}
                label={choice.name}
                icon={choice.icon}
                checked={selected.includes(choice.id)}
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
  selected: OnboardingWorkArea[];
  onChange: (selected: OnboardingWorkArea[]) => void;
}) => {
  const { selected, onChange } = props;
  const { t } = useTranslation("common");
  return (
    <Stack gap="xl">
      <Stack gap="xs" role="group" aria-label={t("onboarding.workAreas")}>
        {workChoices.map((choice) => (
          <ChoiceCard
            key={choice.id}
            label={t(`onboarding.${choice.key}`)}
            icon={choice.icon}
            checked={selected.includes(choice.id)}
            onChange={(checked) => onChange(toggle(selected, choice.id, checked))}
          />
        ))}
      </Stack>
      <Stack gap="xs" role="region" aria-label={t("onboarding.extensions")}>
        <Text textStyle="label/S/medium" color="fg.muted">
          {t("onboarding.extensions")}
        </Text>
        <SimpleCard>
          <SimpleCardBody>
            <Stack gap="md">
              {onboardingExtensions(selected).map((name) => {
                const entry = extensions[name];
                return (
                  <HStack key={name} gap="xs">
                    <Icon boxSize="icon-xs" color="fg.muted">
                      <entry.icon />
                    </Icon>
                    <Text textStyle="label/M/regular">{entry.name}</Text>
                  </HStack>
                );
              })}
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
      </Stack>
    </Stack>
  );
};
