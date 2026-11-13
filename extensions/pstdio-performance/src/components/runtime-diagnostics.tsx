import { Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, Tooltip } from "@pstdio/ui";
import { useId, useState } from "react";
import { type DiagnosticKind, type DiagnosticView, diagnosticLabels, diagnosticRunning } from "../diagnostics/types";
import { useTranslations } from "../translations";

const statuses: Record<DiagnosticView["status"], string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  rejected: "Rejected",
  unavailable: "Status unavailable",
};

export interface RuntimeDiagnosticsProps {
  captures: DiagnosticView[];
  loading?: boolean;
  error?: string;
  onStart: (kind: DiagnosticKind, seconds: number) => void;
  onCancel: (id: string) => void;
  onExport: (id: string) => void;
}

export const RuntimeDiagnostics = (props: RuntimeDiagnosticsProps) => {
  const { captures, loading, error, onStart, onCancel, onExport } = props;
  const { t } = useTranslations();
  const [seconds, setSeconds] = useState("15");
  const durationId = useId();
  const valid = Number.isInteger(Number(seconds)) && Number(seconds) >= 1 && Number(seconds) <= 60;
  const active = captures.some(diagnosticRunning);
  const disabled = Boolean(loading) || active || !valid;
  const latest = captures.find((capture) => capture.summary);
  return (
    <Stack gap="sm" data-testid="runtime-diagnostics">
      <HStack justifyContent="space-between">
        <Text textStyle="label/S/medium">{t("diagnostics.title", "Backend diagnostics")}</Text>
        <HStack gap="xs">
          <label htmlFor={durationId}>
            <Text as="span" textStyle="label/XS" color="fg.muted">
              {t("diagnostics.seconds", "Seconds")}
            </Text>
          </label>
          <Input
            id={durationId}
            aria-label={t("diagnostics.duration", "Capture duration in seconds")}
            type="number"
            min={1}
            max={60}
            step={1}
            size="xs"
            w="20"
            value={seconds}
            onChange={(event) => setSeconds(event.target.value)}
          />
        </HStack>
      </HStack>
      <HStack>
        <Button size="xs" variant="outline" disabled={disabled} onClick={() => onStart("cpu", Number(seconds))}>
          {t("diagnostics.cpu", "Record CPU")}
        </Button>
        <Button size="xs" variant="outline" disabled={disabled} onClick={() => onStart("coverage", Number(seconds))}>
          {t("diagnostics.coverage", "Count calls")}
        </Button>
      </HStack>
      <Text textStyle="label/XS" color="fg.muted">
        {t("diagnostics.scope", "Captures run on the backend. Results stay on that machine.")}
      </Text>
      {error ? <AlertMessage status="error" title={error} /> : null}
      {!captures.length ? (
        <Text textStyle="label/XS" color="fg.muted">
          {loading ? t("diagnostics.reading", "Reading captures…") : t("diagnostics.empty", "No backend captures yet.")}
        </Text>
      ) : null}
      {captures.map((capture) => {
        const running = diagnosticRunning(capture);
        const start = Date.parse(capture.startedAt ?? capture.createdAt);
        const end = capture.finishedAt ? Date.parse(capture.finishedAt) : Date.now();
        const elapsed = Math.max(0, Math.round((end - start) / 1000));
        return (
          <Stack key={capture.id} gap="2xs">
            <HStack align="start" gap="xs">
              <Stack gap="0" minW="0" flex="1">
                <Text textStyle="label/XS">
                  {t(`diagnostics.kind.${capture.kind}`, diagnosticLabels[capture.kind])} ·{" "}
                  {t(`diagnostics.status.${capture.status}`, statuses[capture.status])} ·{" "}
                  {running || capture.finishedAt
                    ? t("diagnostics.elapsed", "{{seconds}} s", { seconds: elapsed })
                    : t("diagnostics.requested", "{{seconds}} s requested", { seconds: capture.seconds })}
                </Text>
                <Text textStyle="mono/XS" color="fg.muted" truncate>
                  {capture.id}
                </Text>
                {capture.pid ? (
                  <Text textStyle="label/XS" color="fg.muted">
                    {capture.hostname} · PID {capture.pid}
                  </Text>
                ) : null}
              </Stack>
              {running ? (
                <Button size="2xs" variant="ghost" disabled={loading} onClick={() => onCancel(capture.id)}>
                  {t("diagnostics.cancel", "Cancel")}
                </Button>
              ) : null}
              {capture.hasResult ? (
                <Button size="2xs" variant="ghost" onClick={() => onExport(capture.id)}>
                  {t("diagnostics.copy", "Copy result")}
                </Button>
              ) : null}
            </HStack>
            {capture.error ? <AlertMessage status="error" title={capture.error} /> : null}
          </Stack>
        );
      })}
      {latest?.summary ? (
        <Stack gap="2xs">
          <Text textStyle="label/XS" color="fg.muted">
            {t("diagnostics.top", "Most frequent functions")} ·{" "}
            {t(`diagnostics.unit.${latest.summary.unit}`, latest.summary.unit)}
          </Text>
          {latest.summary.top.slice(0, 5).map((entry) => (
            <HStack key={`${entry.location}:${entry.name}`} gap="sm">
              <Tooltip content={entry.location}>
                <Text textStyle="mono/XS" truncate minW="0" flex="1">
                  {entry.name}
                </Text>
              </Tooltip>
              <Text textStyle="mono/XS" color="fg.muted">
                {entry.count.toLocaleString()}
              </Text>
            </HStack>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
};
