import { Center, Code } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import { SquareTerminal } from "lucide-react";
import { useTranslation } from "react-i18next";

// A page load never signs a browser in. `pst` and the desktop app give it a session (ADR 0054).
export const BrowserSignInRequired = () => {
  const { t } = useTranslation();

  return (
    <Center minH="100dvh" w="full" bg="bg">
      <EmptyState
        icon={<SquareTerminal />}
        title={t("browserSignIn.title")}
        description={t("browserSignIn.description")}
      >
        <Code>pst</Code>
      </EmptyState>
    </Center>
  );
};
