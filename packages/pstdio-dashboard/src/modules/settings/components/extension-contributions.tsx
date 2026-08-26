import { Code, HStack, Icon, IconButton, Kbd, Stack, Text } from "@chakra-ui/react";
import type { WorkbenchExtensionAutomationRecord } from "@pstdio/sdk/api";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Check,
  Command,
  Copy,
  FileCode,
  LayoutDashboard,
  ListTree,
  MenuIcon,
  Palette,
  PanelsTopLeft,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Timer,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import type { DashboardExtensionMetadata } from "@/shared/extensions/types";

export interface ContributionRecordRow {
  id: string;
  title: string;
  meta?: string;
  /** CLI invocation rendered as copyable code instead of plain meta text. */
  cli?: string;
  /** Keyboard chord rendered as kbd chips instead of plain meta text. */
  keys?: string;
}

interface ContributionGroup {
  key: string;
  icon: LucideIcon;
  rows: ContributionRecordRow[];
}

type MetadataRecord = { extensionId?: string; id?: string; [key: string]: unknown };

const text = (value: unknown, extensionId: string) =>
  value === undefined ? "" : resolveLocalizableString(value as never, extensionId);

const forExtension = (records: MetadataRecord[] | undefined, extensionId: string) =>
  (records ?? []).filter((record) => record.extensionId === extensionId);

const row = (id: string, title: string, meta?: string) => ({ id, title: title || id, meta: meta || undefined });

// Flattens the workbench metadata into the design's grouped record list: one
// group per contribution kind, one row per record (title · id · placement meta).
export const buildContributionGroups = (metadata: DashboardExtensionMetadata | undefined, extensionId: string) => {
  // Keybindings attach to commands, so they render as a column on the command rows.
  const commandKeys = new Map(
    forExtension(metadata?.keybindings, extensionId).flatMap((record) =>
      typeof record.key === "string" ? [[String(record.commandId), record.key] as const] : [],
    ),
  );

  const groups: ContributionGroup[] = [
    {
      key: "harnesses",
      icon: Bot,
      rows: forExtension(metadata?.harnesses, extensionId).map((record) =>
        row(String(record.id), text(record.label, extensionId) || String(record.localId)),
      ),
    },
    {
      key: "commands",
      icon: Terminal,
      rows: forExtension(metadata?.commands, extensionId).map((record) => ({
        ...row(String(record.id), text(record.title, extensionId)),
        cli: typeof record.cliPath === "string" ? `pst ${record.cliPath}` : undefined,
        keys: commandKeys.get(String(record.id)),
      })),
    },
    {
      key: "modes",
      icon: LayoutDashboard,
      rows: forExtension(metadata?.modes, extensionId).map((record) =>
        row(String(record.id), text(record.label, extensionId)),
      ),
    },
    {
      key: "views",
      icon: PanelsTopLeft,
      rows: forExtension(metadata?.views, extensionId).map((record) =>
        row(
          String(record.id),
          text(record.title, extensionId),
          typeof record.path === "string" ? record.path : undefined,
        ),
      ),
    },
    {
      key: "placements",
      icon: LayoutDashboard,
      rows: forExtension(metadata?.placements, extensionId).map((record) =>
        row(String(record.id), String(record.region)),
      ),
    },
    {
      key: "menuContributions",
      icon: MenuIcon,
      rows: forExtension(metadata?.menuContributions, extensionId).map((record) =>
        row(
          String(record.commandId ?? record.id),
          text(record.label, extensionId),
          typeof record.slotId === "string" ? record.slotId : undefined,
        ),
      ),
    },
    {
      key: "settingsPanels",
      icon: SlidersHorizontal,
      rows: forExtension(metadata?.settingsPanels, extensionId).map((record) =>
        row(String(record.id), String((record.view as { id?: unknown }).id ?? record.id)),
      ),
    },
    {
      key: "skills",
      icon: Sparkles,
      rows: forExtension(metadata?.skills, extensionId).map((record) =>
        row(String(record.id), text(record.title, extensionId) || String(record.localId)),
      ),
    },
    {
      key: "templates",
      icon: FileCode,
      rows: forExtension(metadata?.templates, extensionId).map((record) =>
        row(String(record.id), text(record.title, extensionId) || String(record.localId)),
      ),
    },
    {
      key: "themes",
      icon: Palette,
      rows: forExtension(metadata?.themes, extensionId).map((record) =>
        row(String(record.id), text(record.title, extensionId) || String(record.localId)),
      ),
    },
    {
      key: "navigationItems",
      icon: ListTree,
      rows: forExtension(metadata?.navigationItems, extensionId).map((record) =>
        row(String(record.id), text(record.label, extensionId)),
      ),
    },
    {
      key: "commandPaletteResources",
      icon: Command,
      rows: forExtension(metadata?.commandPaletteResources, extensionId).map((record) =>
        row(String(record.id), text(record.label ?? record.title, extensionId)),
      ),
    },
  ];

  return groups.filter((group) => group.rows.length > 0);
};

const GroupLabel = (props: { icon: LucideIcon; label: string; count: number }) => {
  const { icon: GroupIcon, label, count } = props;
  return (
    <HStack gap="2xs" paddingTop="md" paddingBottom="2xs">
      <Icon boxSize="3.5" color="fg.subtle">
        <GroupIcon />
      </Icon>
      <Text textStyle="label/XS/medium" color="fg.subtle" textTransform="uppercase" letterSpacing="0.06em">
        {label}
      </Text>
      <Text textStyle="label/XS" color="fg.subtle">
        {count}
      </Text>
    </HStack>
  );
};

const CopyCliButton = (props: { command: string }) => {
  const { command } = props;
  const { t } = useTranslation("projects");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <IconButton
      variant="ghost"
      size="2xs"
      aria-label={t("projectSettings.extensionsPanel.detail.copyCommand")}
      onClick={copy}
      data-testid="extension-cli-copy"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </IconButton>
  );
};

const chordKeys = (chord: string) => chord.split("+").map((key) => key.trim());

const RecordRow = (props: { record: ContributionRecordRow; endContent?: React.ReactNode }) => {
  const { record, endContent } = props;
  return (
    <HStack gap="md" minH="7" data-testid="extension-contribution-row">
      <Text textStyle="label/S/regular" w="240px" flexShrink="0" truncate>
        {record.title}
      </Text>
      <Text textStyle="label/XS" fontFamily="mono" color="fg.muted" w="280px" flexShrink="0" truncate>
        {record.id}
      </Text>
      <HStack gap="2xs" flex="1" minW="0">
        {record.cli && (
          <>
            <Code textStyle="label/XS">{record.cli}</Code>
            <CopyCliButton command={record.cli} />
          </>
        )}
        {!record.cli && (
          <Text textStyle="label/XS" color="fg.subtle" truncate>
            {record.meta ?? ""}
          </Text>
        )}
      </HStack>
      {record.keys && (
        <HStack gap="2xs" flexShrink="0">
          {chordKeys(record.keys).map((key) => (
            <Kbd key={key} size="sm">
              {key}
            </Kbd>
          ))}
        </HStack>
      )}
      {endContent}
    </HStack>
  );
};

export interface ExtensionContributionsProps {
  metadata: DashboardExtensionMetadata | undefined;
  extensionId: string;
  automations: WorkbenchExtensionAutomationRecord[];
}

// Read-only documentation of everything the extension declares — enablement
// lives on the Settings tab, never here.
export const ExtensionContributions = (props: ExtensionContributionsProps) => {
  const { metadata, extensionId, automations } = props;
  const { t } = useTranslation("projects");
  const groups = buildContributionGroups(metadata, extensionId);

  return (
    <Stack gap="0">
      {automations.length > 0 && (
        <Stack gap="0">
          <GroupLabel
            icon={Timer}
            label={t("projectSettings.extensionsPanel.automations.title")}
            count={automations.length}
          />
          {automations.map((automation) => (
            <RecordRow
              key={automation.id}
              record={{
                id: automation.commandId,
                title: resolveLocalizableString(automation.title, automation.extensionId),
                meta: t("projectSettings.extensionsPanel.automations.cron", { cron: automation.cron }),
              }}
            />
          ))}
        </Stack>
      )}

      {groups.map((group) => (
        <Stack key={group.key} gap="0">
          <GroupLabel
            icon={group.icon}
            label={t(`projectSettings.extensionsPanel.detail.contributionKinds.${group.key}`)}
            count={group.rows.length}
          />
          {group.rows.map((record, index) => (
            <RecordRow key={`${record.id}-${index}`} record={record} />
          ))}
        </Stack>
      ))}

      {groups.length === 0 && automations.length === 0 && (
        <Text textStyle="label/XS" color="fg.muted" paddingTop="xs">
          {t("projectSettings.extensionsPanel.detail.noContributions")}
        </Text>
      )}
    </Stack>
  );
};
