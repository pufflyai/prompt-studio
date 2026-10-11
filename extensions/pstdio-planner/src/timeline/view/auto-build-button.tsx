import { Button } from "@chakra-ui/react";
import { Play } from "lucide-react";

interface AutoBuildButtonProps {
  running: boolean;
  onRun: () => void;
  t: (key: string, fallback?: string) => string;
}

export function AutoBuildButton(props: AutoBuildButtonProps) {
  const { running, onRun, t } = props;
  return (
    <Button size="sm" variant="primary" disabled={running} loading={running} onClick={onRun}>
      <Play />
      {t("commands.autoBuild.title", "Auto build")}
    </Button>
  );
}
