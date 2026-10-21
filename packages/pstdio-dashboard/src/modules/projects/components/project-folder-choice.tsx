import { Button, Dialog, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { Radio, RadioGroup } from "@pstdio/ui";
import { useTranslation } from "react-i18next";

export type ProjectFolderMethod = "clone" | "existing";

export interface ProjectFolderChoiceProps {
  projectName: string;
  /** The project's recorded git remote. Without one, only an existing folder can be chosen. */
  gitRemote: string | null;
  method: ProjectFolderMethod;
  clonePath: string;
  pending: boolean;
  error?: string;
  onMethodChange: (method: ProjectFolderMethod) => void;
  onClonePathChange: (path: string) => void;
  onBrowse: () => void;
  onNotNow: () => void;
  onContinue: () => void;
}

export const ProjectFolderChoice = (props: ProjectFolderChoiceProps) => {
  const {
    projectName,
    gitRemote,
    method,
    clonePath,
    pending,
    error,
    onMethodChange,
    onClonePathChange,
    onBrowse,
    onNotNow,
    onContinue,
  } = props;
  const { t } = useTranslation("projects");
  const cloning = method === "clone";
  return (
    <>
      <Dialog.Header flexDirection="column" alignItems="stretch" gap="2xs">
        <Dialog.Title>{t("folder.title", { name: projectName })}</Dialog.Title>
        <Dialog.Description textStyle="paragraph/S/regular" color="fg.muted">
          {t("folder.description")}
        </Dialog.Description>
      </Dialog.Header>
      <Dialog.Body>
        <RadioGroup value={method} onValueChange={(details) => onMethodChange(details.value as ProjectFolderMethod)}>
          <Stack gap="sm">
            {gitRemote ? (
              <Stack layerStyle="optionCard" gap="xs">
                <Radio value="clone">{t("folder.clone", { remote: gitRemote })}</Radio>
                <HStack gap="xs" ps="lg">
                  <Input
                    size="xs"
                    aria-label={t("folder.clonePath")}
                    value={clonePath}
                    disabled={!cloning}
                    onChange={(event) => onClonePathChange(event.target.value)}
                  />
                  <Button variant="outline" size="xs" disabled={!cloning} onClick={onBrowse}>
                    {t("folder.browse")}
                  </Button>
                </HStack>
              </Stack>
            ) : null}
            <Stack layerStyle="optionCard" gap="2xs">
              <Radio value="existing">{t("folder.existing")}</Radio>
              <Text textStyle="label/S/regular" color="fg.subtle">
                {t("folder.existingHint")}
              </Text>
            </Stack>
          </Stack>
        </RadioGroup>
        {error ? (
          <Text role="alert" mt="sm" textStyle="paragraph/S/regular" color="fg.error">
            {error}
          </Text>
        ) : null}
      </Dialog.Body>
      <Dialog.Footer gap="xs">
        <Button variant="outline" size="sm" onClick={onNotNow}>
          {t("folder.notNow")}
        </Button>
        <Button
          variant="primary"
          size="sm"
          loading={pending}
          disabled={cloning && !clonePath.trim()}
          onClick={onContinue}
        >
          {cloning ? t("folder.cloneAndContinue") : t("folder.chooseFolder")}
        </Button>
      </Dialog.Footer>
    </>
  );
};
