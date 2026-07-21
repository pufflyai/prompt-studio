import { Badge, Box, HStack, Stack, Text } from "@chakra-ui/react";
import { Check, CircleAlert, GitBranch, Rocket } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

export interface PreviewProps {
  assembled: boolean;
}

export type ShowcaseTrayIcon =
  | "git-branch"
  | "git-pull-request"
  | "list-checks"
  | "messages"
  | "rocket"
  | "shield-check"
  | "tags"
  | "terminal"
  | "users";

export interface ShowcaseExample {
  id: string;
  label: string;
  prompt: string;
  preview: ComponentType<PreviewProps>;
  tray: { icon: ShowcaseTrayIcon; label: string }[];
}

interface AssemblePieceProps {
  assembled: boolean;
  children: ReactNode;
  delay: number;
}

const AssemblePiece = (props: AssemblePieceProps) => {
  const { assembled, children, delay } = props;

  return (
    <Box
      width="100%"
      opacity={assembled ? "1" : "0"}
      transform={assembled ? "translateY(0) scale(1)" : "translateY(9px) scale(0.98)"}
      transition="opacity 360ms ease-out, transform 420ms cubic-bezier(0.16, 1, 0.3, 1)"
      transitionDelay={`${delay}ms`}
    >
      {children}
    </Box>
  );
};

interface StatusRowProps {
  assembled: boolean;
  delay: number;
  label: string;
  palette: "gray" | "green";
  status: string;
}

const StatusRow = (props: StatusRowProps) => {
  const { assembled, delay, label, palette, status } = props;

  return (
    <AssemblePiece assembled={assembled} delay={delay}>
      <HStack px="9px" py="6px" bg="bg.subtle" borderWidth="1px" borderColor="border" rounded="4px">
        <Box color={palette === "green" ? "green.500" : "fg.muted"}>
          {palette === "green" ? <Check size={12} /> : <CircleAlert size={12} />}
        </Box>
        <Text flex="1" minWidth="0" fontSize="11px" color="fg" truncate>
          {label}
        </Text>
        <Badge size="xs" variant="subtle" colorPalette={palette}>
          {status}
        </Badge>
      </HStack>
    </AssemblePiece>
  );
};

const ReleasePreview = (props: PreviewProps) => {
  const { assembled } = props;

  return (
    <Stack gap="7px">
      <AssemblePiece assembled={assembled} delay={0}>
        <HStack justify="space-between">
          <Stack gap="1px">
            <Text fontFamily="heading" fontWeight="semibold" fontSize="13px">
              Release readiness
            </Text>
            <Text fontSize="10px" color="fg.muted">
              v0.25.0 · 8 checks
            </Text>
          </Stack>
          <Badge size="xs" variant="subtle" colorPalette="gray">
            2 blockers
          </Badge>
        </HStack>
      </AssemblePiece>
      <AssemblePiece assembled={assembled} delay={80}>
        <Stack gap="4px">
          <HStack justify="space-between">
            <Text fontFamily="mono" fontSize="9px" color="fg.muted">
              READINESS
            </Text>
            <Text fontFamily="mono" fontSize="9px" color="fg.muted">
              72%
            </Text>
          </HStack>
          <Box
            role="progressbar"
            aria-label="Release readiness"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={72}
            height="5px"
            bg="bg.muted"
            overflow="hidden"
          >
            <Box
              height="100%"
              width={assembled ? "72%" : "0%"}
              bg="green.500"
              transition="width 700ms cubic-bezier(0.16, 1, 0.3, 1) 160ms"
            />
          </Box>
        </Stack>
      </AssemblePiece>
      <StatusRow assembled={assembled} delay={150} label="API contracts" status="ready" palette="green" />
      <StatusRow assembled={assembled} delay={230} label="Migration review" status="blocked" palette="gray" />
      <StatusRow assembled={assembled} delay={310} label="Owners assigned" status="2 missing" palette="gray" />
    </Stack>
  );
};

const FeedbackCard = (props: { assembled: boolean; delay: number; label: string; tag: string }) => {
  const { assembled, delay, label, tag } = props;

  return (
    <AssemblePiece assembled={assembled} delay={delay}>
      <Stack gap="5px" p="8px" bg="bg" borderWidth="1px" borderColor="border" rounded="4px">
        <Text fontSize="10px" lineHeight="1.3" color="fg">
          {label}
        </Text>
        <Text fontFamily="mono" fontSize="8px" color="fg.subtle">
          {tag}
        </Text>
      </Stack>
    </AssemblePiece>
  );
};

const FeedbackPreview = (props: PreviewProps) => {
  const { assembled } = props;

  return (
    <Stack gap="8px">
      <AssemblePiece assembled={assembled} delay={0}>
        <HStack justify="space-between">
          <Text fontFamily="heading" fontWeight="semibold" fontSize="13px">
            Client feedback
          </Text>
          <Badge size="xs" variant="subtle" colorPalette="purple">
            4 items
          </Badge>
        </HStack>
      </AssemblePiece>
      <HStack align="stretch" gap="8px">
        <Stack flex="1" minWidth="0" gap="6px" p="7px" bg="bg.subtle" rounded="5px">
          <AssemblePiece assembled={assembled} delay={70}>
            <Text fontFamily="mono" fontSize="9px" color="fg.muted">
              NEEDS REVIEW · 2
            </Text>
          </AssemblePiece>
          <FeedbackCard assembled={assembled} delay={140} label="Export the report as PDF" tag="REPORTING" />
          <FeedbackCard assembled={assembled} delay={220} label="Tighten the empty state" tag="DESIGN" />
        </Stack>
        <Stack flex="1" minWidth="0" gap="6px" p="7px" bg="bg.subtle" rounded="5px">
          <AssemblePiece assembled={assembled} delay={110}>
            <Text fontFamily="mono" fontSize="9px" color="fg.muted">
              APPROVED · 2
            </Text>
          </AssemblePiece>
          <FeedbackCard assembled={assembled} delay={190} label="Surface active filters" tag="TABLE" />
          <FeedbackCard assembled={assembled} delay={270} label="Add reviewer avatars" tag="PEOPLE" />
        </Stack>
      </HStack>
    </Stack>
  );
};

const DeployPreview = (props: PreviewProps) => {
  const { assembled } = props;

  return (
    <Stack gap="8px">
      <AssemblePiece assembled={assembled} delay={0}>
        <HStack justify="space-between">
          <Text fontFamily="heading" fontWeight="semibold" fontSize="13px">
            Preview deploy
          </Text>
          <Badge size="xs" variant="subtle" colorPalette="green">
            ready
          </Badge>
        </HStack>
      </AssemblePiece>
      <AssemblePiece assembled={assembled} delay={90}>
        <HStack p="9px" bg="bg.subtle" borderWidth="1px" borderColor="border" rounded="5px">
          <GitBranch size={13} />
          <Stack gap="0" flex="1" minWidth="0">
            <Text fontFamily="mono" fontSize="10px" color="fg">
              feature/billing-flow
            </Text>
            <Text fontSize="9px" color="fg.muted">
              6 commits ahead of main
            </Text>
          </Stack>
        </HStack>
      </AssemblePiece>
      <AssemblePiece assembled={assembled} delay={170}>
        <HStack gap="7px">
          <Stack flex="1" gap="2px" p="8px" bg="bg.subtle" rounded="4px">
            <Text fontFamily="mono" fontSize="8px" color="fg.subtle">
              ENVIRONMENT
            </Text>
            <Text fontSize="10px">Preview</Text>
          </Stack>
          <Stack flex="1" gap="2px" p="8px" bg="bg.subtle" rounded="4px">
            <Text fontFamily="mono" fontSize="8px" color="fg.subtle">
              REGION
            </Text>
            <Text fontSize="10px">Stockholm</Text>
          </Stack>
        </HStack>
      </AssemblePiece>
      <AssemblePiece assembled={assembled} delay={250}>
        <HStack px="10px" py="7px" justify="center" bg="fg" color="bg" rounded="4px">
          <Rocket size={12} />
          <Text fontFamily="heading" fontWeight="medium" fontSize="10px">
            Deploy preview
          </Text>
        </HStack>
      </AssemblePiece>
      <AssemblePiece assembled={assembled} delay={330}>
        <HStack gap="6px" color="green.500">
          <Check size={12} />
          <Text fontFamily="mono" fontSize="9px">
            preview-184.pstdio.dev
          </Text>
        </HStack>
      </AssemblePiece>
    </Stack>
  );
};

export const SHOWCASE_EXAMPLES: ShowcaseExample[] = [
  {
    id: "release",
    label: "Release",
    prompt: "Build a release dashboard that flags blockers and ownerless checks.",
    preview: ReleasePreview,
    tray: [
      { icon: "list-checks", label: "Release checks" },
      { icon: "shield-check", label: "Quality gates" },
      { icon: "git-pull-request", label: "Pull requests" },
    ],
  },
  {
    id: "feedback",
    label: "Feedback",
    prompt: "Give client feedback a small review board grouped by status.",
    preview: FeedbackPreview,
    tray: [
      { icon: "messages", label: "Feedback" },
      { icon: "users", label: "Reviewers" },
      { icon: "tags", label: "Categories" },
    ],
  },
  {
    id: "deploy",
    label: "Deploy",
    prompt: "Add a one-click preview deployer for the current branch.",
    preview: DeployPreview,
    tray: [
      { icon: "rocket", label: "Deployments" },
      { icon: "git-branch", label: "Branches" },
      { icon: "terminal", label: "Deploy logs" },
    ],
  },
];
