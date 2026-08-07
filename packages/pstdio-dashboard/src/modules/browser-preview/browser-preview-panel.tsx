import { Box, Button, chakra, Flex, HStack, IconButton, Input, Separator, Stack, Text } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { WorkbenchIcon } from "@pstdio/workbench/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildAbsoluteApiUrl } from "@/lib/api";
import { normalizeBrowserPreviewMetadata, updateBrowserPreviewResource } from "./browser-preview-resource";
import {
  type BrowserPreviewUrlPolicy,
  type BrowserPreviewUrlResult,
  normalizeBrowserPreviewUrl,
} from "./browser-preview-url";
import {
  type BrowserPreviewViewport,
  browserPreviewViewportPresets,
  normalizeBrowserPreviewViewport,
} from "./browser-preview-viewport";

const sandboxPolicy =
  "allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox";

const resolveViewportSize = (viewport: BrowserPreviewViewport) => {
  if (viewport.mode === "desktop") return browserPreviewViewportPresets.desktop;
  if (viewport.mode === "mobile") return browserPreviewViewportPresets.mobile;
  if (viewport.mode === "custom") return { width: viewport.width, height: viewport.height };
  return undefined;
};

const titleForUrl = (url: string | undefined, fallback: string) => {
  if (!url) return fallback;
  try {
    return new URL(url).host;
  } catch {
    return fallback;
  }
};

interface BrowserPreviewPanelProps {
  input: WorkbenchPanelRenderInput;
  initialAddressDraft?: string;
  initialHelpOpen?: boolean;
  initialValidation?: BrowserPreviewUrlResult;
  urlPolicy?: BrowserPreviewUrlPolicy;
}

const getRuntimeUrlPolicy = (policy: BrowserPreviewUrlPolicy | undefined): BrowserPreviewUrlPolicy => ({
  dashboardOrigin: policy?.dashboardOrigin ?? globalThis.location?.origin,
  apiOrigin: policy?.apiOrigin ?? new URL(buildAbsoluteApiUrl("")).origin,
});

export const BrowserPreviewPanel = (props: BrowserPreviewPanelProps) => {
  const { input, urlPolicy } = props;
  const { t } = useTranslation("common");
  const runtimeUrlPolicy = getRuntimeUrlPolicy(urlPolicy);
  const metadata = normalizeBrowserPreviewMetadata(input.instance.resource?.metadata, runtimeUrlPolicy);
  const committedUrl = metadata?.url;
  const viewport = normalizeBrowserPreviewViewport(metadata?.viewport);
  const viewportSize = resolveViewportSize(viewport);
  const [addressDraft, setAddressDraft] = useState(props.initialAddressDraft ?? committedUrl ?? "");
  const [validation, setValidation] = useState<BrowserPreviewUrlResult | undefined>(props.initialValidation);
  const [reloadRevision, setReloadRevision] = useState(0);
  const [navigating, setNavigating] = useState(Boolean(committedUrl));
  const [helpOpen, setHelpOpen] = useState(props.initialHelpOpen ?? false);
  const [customWidth, setCustomWidth] = useState(viewport.mode === "custom" ? String(viewport.width) : "1024");
  const [customHeight, setCustomHeight] = useState(viewport.mode === "custom" ? String(viewport.height) : "768");
  const previousCommittedUrl = useRef(committedUrl);

  useEffect(() => {
    if (previousCommittedUrl.current === committedUrl) return;
    previousCommittedUrl.current = committedUrl;
    setAddressDraft(committedUrl ?? "");
  }, [committedUrl]);

  const commitResource = (updates: { url?: string; viewport?: BrowserPreviewViewport }) => {
    if (!input.instance.resource) return;
    const nextResource = updateBrowserPreviewResource(input.instance.resource, updates);
    input.workbench.layout.updatePanel(input.instance.instanceId, {
      resource: nextResource,
      title: titleForUrl(
        typeof nextResource.metadata?.url === "string" ? nextResource.metadata.url : undefined,
        t("browserPreview.panelTitle"),
      ),
    });
  };

  const commitAddress = () => {
    const result = normalizeBrowserPreviewUrl(addressDraft, runtimeUrlPolicy);
    setValidation(result);
    if (!result.ok) return;
    setNavigating(true);
    commitResource({ url: result.url });
  };

  const commitViewport = (nextViewport: BrowserPreviewViewport) => {
    commitResource({ viewport: normalizeBrowserPreviewViewport(nextViewport) });
  };

  const commitCustomViewport = () => {
    commitViewport({
      mode: "custom",
      width: Number(customWidth),
      height: Number(customHeight),
    });
  };

  const copyAddress = async () => {
    if (!committedUrl) return;

    try {
      await navigator.clipboard.writeText(committedUrl);
      input.workbench.notifications.show({
        level: "success",
        title: t("browserPreview.copySuccess"),
        message: committedUrl,
      });
    } catch (error) {
      input.workbench.notifications.show({
        level: "error",
        title: t("browserPreview.copyFailure"),
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const openExternal = () => {
    if (committedUrl) globalThis.open(committedUrl, "_blank", "noopener,noreferrer");
  };

  const reload = () => {
    if (!committedUrl) return;
    setNavigating(true);
    setReloadRevision((revision) => revision + 1);
  };

  let statusLabel = t("browserPreview.status.empty");
  if (committedUrl) statusLabel = t("browserPreview.status.ready");
  if (navigating) statusLabel = t("browserPreview.status.loading");
  const viewportStatusLabel =
    viewport.mode === "custom"
      ? `${viewport.width} x ${viewport.height}`
      : t(`browserPreview.viewports.${viewport.mode}`);

  return (
    <Flex h="full" minH="0" minW="0" direction="column" bg="bg">
      <HStack gap="xs" px="sm" py="xs" borderBottomWidth="1px" borderColor="border.muted" flexWrap="wrap">
        <Box
          as="form"
          minW="18rem"
          flex="1"
          onSubmit={(event) => {
            event.preventDefault();
            commitAddress();
          }}
        >
          <HStack gap="xs">
            <Input
              size="sm"
              value={addressDraft}
              placeholder="http://localhost:5173"
              aria-label={t("browserPreview.addressLabel")}
              onChange={(event) => {
                setAddressDraft(event.target.value);
                setValidation(undefined);
              }}
            />
            <Tooltip content={t("browserPreview.openAddress")}>
              <IconButton size="sm" variant="subtle" type="submit" aria-label={t("browserPreview.openAddress")}>
                <WorkbenchIcon name="arrow-right" size={16} />
              </IconButton>
            </Tooltip>
          </HStack>
        </Box>
        <Tooltip content={t("browserPreview.reload")}>
          <IconButton
            size="sm"
            variant="ghost"
            aria-label={t("browserPreview.reloadAria")}
            disabled={!committedUrl}
            onClick={reload}
          >
            <WorkbenchIcon name="refresh-cw" size={16} />
          </IconButton>
        </Tooltip>
        <Tooltip content={t("browserPreview.copyUrl")}>
          <IconButton
            size="sm"
            variant="ghost"
            aria-label={t("browserPreview.copyUrlAria")}
            disabled={!committedUrl}
            onClick={() => void copyAddress()}
          >
            <WorkbenchIcon name="copy" size={16} />
          </IconButton>
        </Tooltip>
        <Tooltip content={t("browserPreview.openExternal")}>
          <IconButton
            size="sm"
            variant="ghost"
            aria-label={t("browserPreview.openExternalAria")}
            disabled={!committedUrl}
            onClick={openExternal}
          >
            <WorkbenchIcon name="external-link" size={16} />
          </IconButton>
        </Tooltip>
        <Separator orientation="vertical" h="6" />
        <HStack gap="1" aria-label={t("browserPreview.viewportLabel")}>
          {(["responsive", "desktop", "mobile"] as const).map((mode) => (
            <Button
              key={mode}
              size="xs"
              variant={viewport.mode === mode ? "subtle" : "ghost"}
              aria-pressed={viewport.mode === mode}
              onClick={() => commitViewport({ mode })}
            >
              {t(`browserPreview.viewports.${mode}`)}
            </Button>
          ))}
        </HStack>
        <HStack gap="1">
          <Input
            size="xs"
            w="4.5rem"
            value={customWidth}
            aria-label={t("browserPreview.customWidth")}
            onChange={(event) => setCustomWidth(event.target.value)}
          />
          <Text color="fg.muted" textStyle="paragraph/XS/regular">
            x
          </Text>
          <Input
            size="xs"
            w="4.5rem"
            value={customHeight}
            aria-label={t("browserPreview.customHeight")}
            onChange={(event) => setCustomHeight(event.target.value)}
          />
          <Button
            size="xs"
            variant={viewport.mode === "custom" ? "subtle" : "ghost"}
            aria-pressed={viewport.mode === "custom"}
            onClick={commitCustomViewport}
          >
            {t("browserPreview.viewports.custom")}
          </Button>
        </HStack>
        <Tooltip content={t("browserPreview.help")}>
          <IconButton
            size="sm"
            variant="ghost"
            aria-label={t("browserPreview.helpAria")}
            onClick={() => setHelpOpen((open) => !open)}
          >
            <WorkbenchIcon name="circle-help" size={16} />
          </IconButton>
        </Tooltip>
      </HStack>

      {validation && !validation.ok ? (
        <Text px="sm" py="xs" color="fg.error" textStyle="paragraph/S/regular">
          {t(`browserPreview.errors.${validation.reason}`)}
        </Text>
      ) : null}

      {helpOpen ? (
        <Stack gap="xs" px="sm" py="sm" borderBottomWidth="1px" borderColor="border.muted" bg="bg.subtle">
          <Text textStyle="paragraph/S/semibold">{t("browserPreview.framingTitle")}</Text>
          <Text color="fg.muted" textStyle="paragraph/S/regular">
            {t("browserPreview.framingDescription")}
          </Text>
        </Stack>
      ) : null}

      <Flex flex="1" minH="0" minW="0" align="center" justify="center" overflow="auto" bg="bg.subtle" p="sm">
        {committedUrl ? (
          <Box
            borderWidth="1px"
            borderColor="border.muted"
            bg="bg"
            w={viewportSize ? `${viewportSize.width}px` : "full"}
            h={viewportSize ? `${viewportSize.height}px` : "full"}
            maxW="full"
            maxH="full"
          >
            <chakra.iframe
              key={`${committedUrl}:${reloadRevision}`}
              title="Browser Preview"
              src={committedUrl}
              sandbox={sandboxPolicy}
              referrerPolicy="no-referrer"
              w="full"
              h="full"
              borderWidth="0"
              onLoad={() => setNavigating(false)}
            />
          </Box>
        ) : (
          <Stack gap="sm" align="center" maxW="28rem" textAlign="center">
            <WorkbenchIcon name="panel-top" size={28} />
            <Text textStyle="title/S/semibold">{t("browserPreview.title")}</Text>
            <Text color="fg.muted" textStyle="paragraph/S/regular">
              {t("browserPreview.emptyDescription")}
            </Text>
          </Stack>
        )}
      </Flex>

      <HStack minH="8" px="sm" borderTopWidth="1px" borderColor="border.muted" justify="space-between">
        <Text color="fg.muted" textStyle="paragraph/XS/regular">
          {statusLabel}
        </Text>
        <Text color="fg.muted" textStyle="paragraph/XS/regular">
          {viewportStatusLabel}
        </Text>
      </HStack>
    </Flex>
  );
};
