import { Button, Flex, HStack, Menu, Portal, Text } from "@chakra-ui/react";
import { useCommandQuery } from "@pstdio/sdk/extensions/react";
import { AlertMessage, SegmentedControl } from "@pstdio/ui";
import { ChevronDown, Globe } from "lucide-react";
import { useState } from "react";
import { type Site, sites } from "../schemas";
import { siteLabels } from "../sites";
import { threadResource } from "../store";
import { useOpenThread, useRadar, useRadarRefresh } from "../webview/client";
import { AnalysisSections } from "./analysis-sections";

const time = (value: string) => new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export const AnalysisPage = () => {
  const { client } = useRadar();
  const openThread = useOpenThread();
  const [days, setDays] = useState("14");
  const [site, setSite] = useState<Site | "">("");
  useRadarRefresh();
  const analysis = useCommandQuery({
    queryKey: ["analysis", days, site],
    command: () => client.commands["list-analysis"]({ days: Number(days), ...(site ? { site } : {}) }),
  });
  return (
    <Flex direction="column" gap="md" p="lg" h="full" minH="0">
      <HStack gap="sm" flexShrink={0}>
        <SegmentedControl
          aria-label="Period"
          value={days}
          onValueChange={setDays}
          options={[
            { value: "14", label: "14 days" },
            { value: "30", label: "30 days" },
          ]}
        />
        <Menu.Root onSelect={({ value }) => setSite(value as Site | "")}>
          <Menu.Trigger asChild>
            <Button size="sm" variant="outline">
              <Globe />
              {site ? siteLabels[site] : "All sites"}
              <ChevronDown />
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item value="">All sites</Menu.Item>
                {sites.map((value) => (
                  <Menu.Item key={value} value={value}>
                    {siteLabels[value]}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
        <Text flex="1" textAlign="end" textStyle="label/S/regular" color="fg.muted">
          {analysis.data?.updatedAt ? `Updated ${time(analysis.data.updatedAt)}` : "No finished run yet"}
        </Text>
      </HStack>
      {analysis.error ? <AlertMessage status="error" title={analysis.error.message} /> : null}
      {analysis.data ? (
        <AnalysisSections
          analysis={analysis.data}
          onOpenMention={(mention) => openThread({ type: threadResource.id, id: mention.id, label: mention.title })}
        />
      ) : null}
    </Flex>
  );
};
