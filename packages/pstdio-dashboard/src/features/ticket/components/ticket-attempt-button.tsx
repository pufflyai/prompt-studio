import { Button, HStack, Text } from "@chakra-ui/react";
import { DiffBubble } from "@pstdio/ui";
import { GitBranch } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CreateWorkspaceModal } from "./create-workspace-modal";

interface TicketAttemptButtonProps {
  attemptCount: number;
  additions: number;
  deletions: number;
  isRunning?: boolean;
  isDisabled?: boolean;
  onRunAttempt: () => Promise<boolean> | boolean;
  onViewWorkspace?: () => void;
}

export const TicketAttemptButton = (props: TicketAttemptButtonProps) => {
  const {
    attemptCount,
    additions,
    deletions,
    isRunning = false,
    isDisabled = false,
    onRunAttempt,
    onViewWorkspace,
  } = props;
  const { t } = useTranslation("tickets");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const hasAttempts = attemptCount > 0;
  const attemptLabel = `${attemptCount}`;

  const handleClose = () => {
    if (isRunning) return;
    setIsDialogOpen(false);
  };

  const handleClick = () => {
    if (attemptCount > 0 && onViewWorkspace) {
      onViewWorkspace();
      return;
    }

    setIsDialogOpen(true);
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={handleClick} disabled={isDisabled} loading={isRunning}>
        {hasAttempts ? (
          <HStack as="span" gap="2xs">
            <GitBranch size={10} />
            <Text as="span">{attemptLabel}</Text>
            <DiffBubble additions={additions} deletions={deletions} variant="ghost" size="small" />
          </HStack>
        ) : (
          t("ticketDetail.runAttempt")
        )}
      </Button>

      {isDialogOpen ? (
        <CreateWorkspaceModal
          open={isDialogOpen}
          attemptCount={attemptCount}
          isSubmitting={isRunning}
          isDisabled={isDisabled}
          onClose={handleClose}
          onConfirm={onRunAttempt}
        />
      ) : null}
    </>
  );
};
