import { AlertMessage } from "@pstdio/ui";

interface CommandComposerNoticesProps {
  error: string | null;
  outcome: string | null;
  onDismissError: () => void;
  onDismissOutcome: () => void;
}

export const CommandComposerNotices = (props: CommandComposerNoticesProps) => {
  const { error, outcome, onDismissError, onDismissOutcome } = props;
  return (
    <>
      {error ? (
        <AlertMessage status="error" title="Command failed" onClose={onDismissError}>
          {error}
        </AlertMessage>
      ) : null}
      {outcome ? (
        <AlertMessage status="info" title="Command result" onClose={onDismissOutcome}>
          {outcome}
        </AlertMessage>
      ) : null}
    </>
  );
};
