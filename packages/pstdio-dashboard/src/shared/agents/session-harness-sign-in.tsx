import { Button, Icon } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import { LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SessionHarnessSignInProps {
  name: string;
  onLogin(): void;
}

export const SessionHarnessSignIn = (props: SessionHarnessSignInProps) => {
  const { name, onLogin } = props;
  const { t } = useTranslation("projects");
  return (
    <EmptyState
      title={t("harnessAccount.loginTitle", { name })}
      description={t("harnessAccount.requiredDescription")}
      icon={<Icon as={LogIn} boxSize="12" />}
    >
      <Button size="sm" variant="outline" onClick={onLogin}>
        {t("harnessAccount.login")}
      </Button>
    </EmptyState>
  );
};
