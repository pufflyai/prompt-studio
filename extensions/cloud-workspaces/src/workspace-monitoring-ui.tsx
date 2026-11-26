import { Button, Flex, Stack, Text } from "@chakra-ui/react";
import { isLocalizedString } from "@pstdio/sdk/extensions";
import { SegmentedControl, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { historyRanges } from "./workspace-history-range";

export type Translate = (key: string, fallback: string, args?: Record<string, unknown>) => string;

export function monitoringFormat(locale: string, t: Translate) {
  const unavailable = t("cloud-workspaces.monitoring-unavailable", "Unavailable");
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "USD", currencyDisplay: "code" });
  const date = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return {
    number,
    money: (value: number | null) => (value === null ? unavailable : money.format(value)),
    hours: (value: number | null) =>
      value === null
        ? unavailable
        : t("cloud-workspaces.monitoring-hours", "{{hours}} h", {
            hours: value > 0 && value < 360_000 ? `<${number.format(0.1)}` : number.format(value / 3_600_000),
          }),
    date,
  };
}

export function MonitoringRangeControl(props: { range: string; onChange(value: string): void; t: Translate }) {
  const { range, onChange, t } = props;
  return (
    <SegmentedControl
      aria-label={t("cloud-workspaces.time-range", "Time range")}
      options={historyRanges.map(({ label, value, localizedLabel }) => ({
        label: isLocalizedString(localizedLabel) ? t(localizedLabel.$l10n, label) : label,
        value,
      }))}
      value={range}
      onValueChange={onChange}
    />
  );
}

export function Metric(props: { label: string; value: string }) {
  const { label, value } = props;
  return (
    <SimpleCard minW="0">
      <SimpleCardBody>
        <Text color="fg.muted" textStyle="label/S/regular">
          {label}
        </Text>
        <Text textStyle="heading/M" overflowWrap="anywhere" fontVariantNumeric="tabular-nums">
          {value}
        </Text>
      </SimpleCardBody>
    </SimpleCard>
  );
}

export function MonitoringError(props: { message: string; retry?: () => void; dismiss?: () => void; t: Translate }) {
  const { message, retry, dismiss, t } = props;
  return (
    <Stack role="status" gap="xs" p="sm" borderWidth="1px" rounded="xs">
      <Text overflowWrap="anywhere">{message}</Text>
      {(retry || dismiss) && (
        <Flex gap="xs" wrap="wrap">
          {retry && (
            <Button size="xs" onClick={retry}>
              {t("cloud-workspaces.monitoring-retry", "Retry")}
            </Button>
          )}
          {dismiss && (
            <Button size="xs" variant="ghost" onClick={dismiss}>
              {t("cloud-workspaces.monitoring-dismiss", "Dismiss")}
            </Button>
          )}
        </Flex>
      )}
    </Stack>
  );
}
