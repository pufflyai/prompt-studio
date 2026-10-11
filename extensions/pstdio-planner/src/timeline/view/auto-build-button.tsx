import { Button, Spinner } from "@chakra-ui/react";
import { Play, Square } from "lucide-react";

interface AutoBuildButtonProps {
  enabled: boolean;
  running: boolean;
  disabled?: boolean;
  onConfigure: () => void;
  onTurnOff: () => void;
  t: (key: string, fallback?: string) => string;
}

export function AutoBuildButton(props: AutoBuildButtonProps) {
  const { enabled, running, disabled, onConfigure, onTurnOff, t } = props;
  return (
    <Button size="2xs" variant="outline" disabled={disabled} onClick={enabled ? onTurnOff : onConfigure}>
      {running ? <Spinner size="xs" /> : null}
      {enabled ? <Square /> : <Play />}
      {enabled ? t("timeline.autoBuild.stop", "Stop Auto Build") : t("timeline.autoBuild.start", "Auto Build")}
    </Button>
  );
}
