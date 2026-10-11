// Explain why the timeline cannot load, such as a Track property it cannot use, instead of an empty graph.
import { EmptyState } from "@pstdio/ui";

interface PlanUnavailableProps {
  message: string;
  t: (key: string, fallback?: string) => string;
}

export function PlanUnavailable(props: PlanUnavailableProps) {
  const { message, t } = props;
  return (
    <EmptyState
      role="alert"
      maxW="lg"
      mx="auto"
      title={t("timeline.unavailable.title", "The timeline cannot load")}
      description={message}
    />
  );
}
