import { AbsoluteCenter, Button, Stack, Text } from "@chakra-ui/react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { AlertMessage } from "@/components/primitives/alert";
import { ContentPlaceholder } from "@/components/primitives/content-placeholder";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  label?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Dashboard error boundary caught an error", error, info);
  }

  handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { children, fallback, label } = this.props;
    const { error } = this.state;

    if (error) {
      if (fallback) {
        return fallback;
      }

      return <ErrorFallback error={error} label={label} onReset={this.handleReset} />;
    }

    return children;
  }
}

interface ErrorFallbackProps {
  error: Error;
  label?: string;
  onReset?: () => void;
}

export const ErrorFallback = (props: ErrorFallbackProps) => {
  const { error, label, onReset } = props;

  return (
    <ContentPlaceholder height="100%" width="100%">
      <AbsoluteCenter>
        <AlertMessage
          status="error"
          title={<Text textStyle="paragraph/M/medium">{label ?? "Something went wrong"}</Text>}
        >
          <Stack gap="sm">
            <Text textStyle="paragraph/S/regular">
              {error.message || "An unexpected error occurred while rendering this section."}
            </Text>
            {onReset ? (
              <Button size="sm" variant="primary" onClick={onReset}>
                Try again
              </Button>
            ) : null}
          </Stack>
        </AlertMessage>
      </AbsoluteCenter>
    </ContentPlaceholder>
  );
};
