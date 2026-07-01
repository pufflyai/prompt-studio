import { Badge, Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { Header, ItemSection, ResizableSplitLayout } from "@/components/layout";
import { InfoCard } from "@/components/primitives/info-card";
import { SimpleCard, SimpleCardBody } from "@/components/primitives/simple-card";
import { GalleryCard, GallerySection } from "../gallery-frame";

const panelRows = ["Prompt settings", "Run history", "Validation notes"];
const panelGroups = [
  { title: "Context", rows: ["Project brief", "Linked resources", "Open workspace"] },
  { title: "Controls", rows: ["Model", "Temperature", "Review mode"] },
  { title: "Output", rows: ["Preview", "Validation", "Export"] },
];

export const PanelsSection = () => {
  return (
    <GallerySection title="Panels" description="Framed content regions for dense product workflows.">
      <GalleryCard title="Info panel" names={["InfoCard", "SimpleCard"]}>
        <SimpleCard>
          <SimpleCardBody>
            <InfoCard
              title="Release readiness"
              description="Checklist state for a package update."
              badge={<Badge colorPalette="green">Ready</Badge>}
              actions={<Button size="xs">Open</Button>}
              infoItems={[
                { label: "Owner", value: "UI package" },
                { label: "Checks", value: <Badge colorPalette="blue">4 passed</Badge> },
              ]}
            />
          </SimpleCardBody>
        </SimpleCard>
      </GalleryCard>

      <GalleryCard title="Disclosure panel" names={["ItemSection"]}>
        <Stack borderWidth="1px" borderColor="border.subtle" borderRadius="xs" overflow="hidden">
          <ItemSection title="Panel group" defaultOpen>
            <Stack gap="xs" padding="sm">
              {panelRows.map((row) => (
                <HStack key={row} justifyContent="space-between" gap="sm">
                  <Text textStyle="label/S/regular">{row}</Text>
                  <Badge colorPalette="gray">Open</Badge>
                </HStack>
              ))}
            </Stack>
          </ItemSection>
        </Stack>
      </GalleryCard>

      <GalleryCard title="Panel group" names={["ItemSection", "Button"]}>
        <Stack gap="0" borderWidth="1px" borderColor="border.subtle" borderRadius="xs" overflow="hidden">
          {panelGroups.map((group, index) => (
            <Box key={group.title} borderTopWidth={index === 0 ? "0" : "1px"} borderTopColor="border.subtle">
              <ItemSection title={group.title} defaultOpen={index !== 1} action={<Button size="xs">Edit</Button>}>
                <Stack gap="0" paddingBottom="xs">
                  {group.rows.map((row) => (
                    <HStack key={row} minH="1.75rem" justifyContent="space-between" gap="sm" paddingX="sm">
                      <Text textStyle="label/S/regular">{row}</Text>
                      <Badge colorPalette={index === 2 ? "green" : "gray"}>{index === 2 ? "Ready" : "Set"}</Badge>
                    </HStack>
                  ))}
                </Stack>
              </ItemSection>
            </Box>
          ))}
        </Stack>
      </GalleryCard>

      <GalleryCard
        title="Resizable panel"
        names={["ResizableSplitLayout", "Header"]}
        gridColumn={{ base: "auto", xl: "span 2" }}
      >
        <Box height="18rem" minW="0" borderWidth="1px" borderColor="border.subtle" borderRadius="xs" overflow="hidden">
          <ResizableSplitLayout
            defaultSizePx={220}
            minSizePx={160}
            contentMinSizePx={260}
            resizablePanel={
              <Stack width="full" gap="0" bg="bg.subtle">
                <Header variant="narrow">
                  <Text textStyle="label/S/medium">Panel index</Text>
                </Header>
                <Stack gap="2xs" padding="sm">
                  {panelRows.map((row) => (
                    <Button key={row} size="xs" variant="ghost" justifyContent="flex-start">
                      {row}
                    </Button>
                  ))}
                </Stack>
              </Stack>
            }
            contentPanel={
              <Stack width="full" gap="0">
                <Header variant="main" background="bg">
                  <Text textStyle="label/M/medium">Panel detail</Text>
                  <Button size="xs" marginInlineStart="auto">
                    Save
                  </Button>
                </Header>
                <Stack gap="xs" padding="md">
                  <Text textStyle="heading/S/medium">Validation notes</Text>
                  <Text textStyle="paragraph/S/regular" color="fg.muted">
                    Dense panel layouts keep navigation, context, and edit actions visible together.
                  </Text>
                </Stack>
              </Stack>
            }
          />
        </Box>
      </GalleryCard>
    </GallerySection>
  );
};
