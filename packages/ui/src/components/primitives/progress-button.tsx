import { Button, type ButtonProps, Progress, useSlotRecipe } from "@chakra-ui/react";
import { forwardRef } from "react";

export interface ProgressButtonProps extends ButtonProps {
  progress?: { value: number | null; max?: number; label: string };
  status?: "queued" | "running" | "success" | "error";
}

export const ProgressButton = forwardRef<HTMLButtonElement, ProgressButtonProps>(function ProgressButton(props, ref) {
  const { progress, status, children, ...rest } = props;
  const styles = useSlotRecipe({ key: "progressButton" })({});
  return (
    <Button ref={ref} {...rest} css={styles.button} data-status={status}>
      {children}
      {progress && (
        <Progress.Root value={progress.value} max={progress.max} aria-label={progress.label} css={styles.progress}>
          <Progress.Track css={styles.track}>
            <Progress.Range css={styles.range} />
          </Progress.Track>
        </Progress.Root>
      )}
    </Button>
  );
});
