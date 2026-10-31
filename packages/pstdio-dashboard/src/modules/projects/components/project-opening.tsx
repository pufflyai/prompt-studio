import { Button, Dialog, HStack, Spinner, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { useTranslation } from "react-i18next";

export interface ProjectOpeningProps {
  projectName: string;
  downloading?: boolean;
  error?: string;
  onRetry: () => void;
  onBack: () => void;
}

export const ProjectOpening = (props: ProjectOpeningProps) => {
  const { projectName, downloading, error, onRetry, onBack } = props;
  const { t } = useTranslation("projects");
  return (
    <>
      <Dialog.Header>
        <Dialog.Title>{t("opening.title", { name: projectName })}</Dialog.Title>
      </Dialog.Header>
      <Dialog.Body>
        {error ? (
          <AlertMessage
            status="error"
            title={t("opening.failed")}
            endElement={<Button onClick={onRetry}>{t("opening.retry")}</Button>}
          >
            {error}
          </AlertMessage>
        ) : (
          <HStack gap="sm" role="status">
            <Spinner size="sm" />
            <Text textStyle="paragraph/S/regular">
              {downloading ? t("opening.downloading") : t("opening.preparing")}
            </Text>
          </HStack>
        )}
      </Dialog.Body>
      <Dialog.Footer>
        {downloading && !error ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {t("opening.retry")}
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onClick={onBack}>
          {t("opening.back")}
        </Button>
      </Dialog.Footer>
    </>
  );
};
