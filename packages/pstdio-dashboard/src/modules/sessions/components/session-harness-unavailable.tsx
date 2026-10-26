import { Button, HStack, Icon, IconButton } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import { Square, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SessionHarnessUnavailableProps {
  onReviewExtensions: () => void;
  onInterrupt?: () => void;
}

export const SessionHarnessUnavailable = (props: SessionHarnessUnavailableProps) => {
  const { onReviewExtensions, onInterrupt } = props;
  const { t } = useTranslation("projects");
  return (
    <EmptyState
      title={t("harnessAccount.noHarnessTitle")}
      description={t("harnessAccount.noHarnessDescription")}
      icon={<Icon as={TriangleAlert} color="fg.warning" boxSize="12" />}
    >
      <HStack gap="2xs">
        <Button size="2xs" variant="outline" onClick={onReviewExtensions}>
          {t("harnessAccount.extensions")}
        </Button>
        {onInterrupt ? (
          <IconButton size="2xs" variant="ghost" aria-label="Stop session" onClick={onInterrupt}>
            <Square />
          </IconButton>
        ) : null}
      </HStack>
    </EmptyState>
  );
};
