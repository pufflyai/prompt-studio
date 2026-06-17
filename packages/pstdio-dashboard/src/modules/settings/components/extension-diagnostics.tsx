import { Collapsible, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import type { ExtensionDiagnostic } from "@pstdio/sdk/api";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, AlertTriangle, ChevronRight, Info } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ExtensionDiagnosticsProps {
  diagnostics: ExtensionDiagnostic[];
}

const severityOrder: ExtensionDiagnostic["severity"][] = ["error", "warning", "info"];

const severityStyles: Record<
  ExtensionDiagnostic["severity"],
  {
    color: string;
    icon: LucideIcon;
  }
> = {
  error: {
    color: "fg.error",
    icon: AlertCircle,
  },
  info: {
    color: "fg.muted",
    icon: Info,
  },
  warning: {
    color: "fg.warning",
    icon: AlertTriangle,
  },
};

const getDiagnosticContext = (diagnostic: ExtensionDiagnostic) =>
  [diagnostic.commandId, diagnostic.sourcePath].filter(Boolean);

export const ExtensionDiagnostics = (props: ExtensionDiagnosticsProps) => {
  const { diagnostics } = props;
  const { t } = useTranslation("projects");

  if (diagnostics.length === 0) return null;

  const severitySummary = severityOrder
    .map((severity) => ({
      count: diagnostics.filter((diagnostic) => diagnostic.severity === severity).length,
      severity,
    }))
    .filter((item) => item.count > 0);

  return (
    <Collapsible.Root width="full" data-testid="extension-card-diagnostics">
      <Collapsible.Trigger
        type="button"
        display="flex"
        width="full"
        alignItems="center"
        justifyContent="space-between"
        gap="2"
        borderTopWidth="1px"
        borderColor="border.muted"
        marginTop="3"
        paddingTop="3"
        color="fg.muted"
        cursor="pointer"
        _hover={{ color: "fg.default" }}
        data-testid="extension-diagnostics-trigger"
      >
        <HStack gap="2" flexWrap="wrap">
          <Collapsible.Indicator transition="transform 0.2s" _open={{ transform: "rotate(90deg)" }}>
            <ChevronRight size={14} />
          </Collapsible.Indicator>
          <Text textStyle="paragraph/S/medium">
            {t("projectSettings.extensionsPanel.diagnostics.issueCount", { count: diagnostics.length })}
          </Text>
          {severitySummary.map((item) => {
            const style = severityStyles[item.severity];

            return (
              <HStack key={item.severity} gap="1">
                <Icon
                  as={style.icon}
                  boxSize="3.5"
                  color={style.color}
                  aria-label={t(`projectSettings.extensionsPanel.diagnostics.severity.${item.severity}`)}
                />
                <Text textStyle="paragraph/XS/regular">
                  {t(`projectSettings.extensionsPanel.diagnostics.severityCount.${item.severity}`, {
                    count: item.count,
                  })}
                </Text>
              </HStack>
            );
          })}
        </HStack>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <Stack gap="2" paddingTop="3" data-testid="extension-diagnostic-list">
          {diagnostics.map((diagnostic, index) => {
            const style = severityStyles[diagnostic.severity];
            const context = getDiagnosticContext(diagnostic);

            return (
              <HStack
                key={`${diagnostic.code}:${diagnostic.message}:${diagnostic.commandId ?? "extension"}:${diagnostic.sourcePath ?? index}`}
                gap="2"
                alignItems="flex-start"
                data-testid="extension-diagnostic"
              >
                <Icon
                  as={style.icon}
                  boxSize="4"
                  color={style.color}
                  flexShrink="0"
                  marginTop="0.5"
                  aria-label={t(`projectSettings.extensionsPanel.diagnostics.severity.${diagnostic.severity}`)}
                />
                <Stack gap="0" minW="0">
                  <Text textStyle="paragraph/S/regular">{diagnostic.message}</Text>
                  {context.length > 0 && (
                    <Text textStyle="paragraph/XS/regular" color="fg.muted">
                      {context.join(" | ")}
                    </Text>
                  )}
                </Stack>
              </HStack>
            );
          })}
        </Stack>
      </Collapsible.Content>
    </Collapsible.Root>
  );
};
