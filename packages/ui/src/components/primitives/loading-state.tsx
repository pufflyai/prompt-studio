import { EmptyState, type EmptyStateProps } from "./empty-state";
import { LogoLoader } from "./logo-loader";

export interface LoadingStateProps extends Omit<EmptyStateProps, "icon"> {
  /** Accessible name announced while loading when there is no title. */
  label?: string;
}

/** Centered loading state for pages, panels and dialogs: the animated logo, with optional text. */
export const LoadingState = (props: LoadingStateProps) => {
  const { title, label = "Loading", ...rest } = props;
  return (
    <EmptyState
      role="status"
      aria-live="polite"
      aria-label={title ?? label}
      flex="1"
      width="full"
      height="full"
      display="flex"
      alignItems="center"
      justifyContent="center"
      title={title}
      icon={<LogoLoader />}
      {...rest}
    />
  );
};
