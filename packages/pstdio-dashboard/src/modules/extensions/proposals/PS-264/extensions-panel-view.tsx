import { Badge, Button, HStack, Icon, Input, InputGroup, Stack, Text } from "@chakra-ui/react";
import { Search } from "lucide-react";
import { useState } from "react";
import { PageContentLayout } from "@/shared/components/page-content-layout";
import { ExtensionDetail } from "./extension-detail";
import { installedExtensions, type ScopeFilter, type VisibilityFilter } from "./extension-fixtures";
import { ExtensionFilter } from "./extension-labels";
import { ExtensionListRow } from "./extension-list-row";

// Proposal copy of the installed list. All interactions stay in this frame's synthetic state.
export const ExtensionsPanelView = () => {
  const [extensions, setExtensions] = useState(installedExtensions);
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<VisibilityFilter>("all");
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [selectedId, setSelectedId] = useState<string>();
  const selected = extensions.find((extension) => extension.id === selectedId);
  const query = search.trim().toLowerCase();
  const searched = extensions.filter((extension) =>
    [extension.displayName, extension.extensionId, extension.description ?? ""].some((value) =>
      value.toLowerCase().includes(query),
    ),
  );
  const matchesVisibility = searched.filter((extension) => visibility === "all" || extension.visibility === visibility);
  const matchesScope = searched.filter((extension) => scope === "all" || extension.scope === scope);
  const visible = matchesVisibility.filter((extension) => scope === "all" || extension.scope === scope);
  const groups = [
    { title: "Enabled", extensions: visible.filter((extension) => extension.enabled) },
    { title: "Installed", extensions: visible.filter((extension) => !extension.enabled) },
  ];
  const filtered = visibility !== "all" || scope !== "all" || Boolean(query);
  const toggle = (id: string, enabled: boolean) => {
    setExtensions((current) =>
      current.map((extension) => {
        if (extension.id !== id) return extension;
        let status: typeof extension.status = enabled ? "loaded" : "disabled";
        if (enabled && extension.lastError) status = "error";
        return { ...extension, enabled, status };
      }),
    );
  };
  const clearFilters = () => {
    setVisibility("all");
    setScope("all");
    setSearch("");
  };

  if (selected) {
    return (
      <ExtensionDetail
        extension={selected}
        onBack={() => setSelectedId(undefined)}
        onToggle={(enabled) => toggle(selected.id, enabled)}
      />
    );
  }

  return (
    <PageContentLayout
      testId="extension-visibility-preview"
      header={
        <Stack bg="bg" gap="0">
          <Stack padding="lg" gap="md" borderBottomWidth="1px" borderColor="border.subtle">
            <HStack justify="space-between" gap="md" flexWrap="wrap">
              <Text textStyle="heading/M">Extensions</Text>
              <InputGroup startElement={<Icon as={Search} boxSize="3.5" />} w={{ base: "full", sm: "64" }}>
                <Input
                  size="sm"
                  placeholder="Search extensions"
                  aria-label="Search extensions"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </InputGroup>
            </HStack>
            <HStack gap="sm" flexWrap="wrap">
              <ExtensionFilter
                label="Visibility"
                value={visibility}
                options={[
                  { value: "all", label: "All visibility", count: matchesScope.length },
                  {
                    value: "public",
                    label: "Public",
                    count: matchesScope.filter((extension) => extension.visibility === "public").length,
                  },
                  {
                    value: "private",
                    label: "Private",
                    count: matchesScope.filter((extension) => extension.visibility === "private").length,
                  },
                ]}
                onChange={(value) => setVisibility(value as VisibilityFilter)}
              />
              <ExtensionFilter
                label="Scope"
                value={scope}
                options={[
                  { value: "all", label: "All scopes", count: matchesVisibility.length },
                  {
                    value: "repo",
                    label: "This Project",
                    count: matchesVisibility.filter((extension) => extension.scope === "repo").length,
                  },
                  {
                    value: "global",
                    label: "All Projects",
                    count: matchesVisibility.filter((extension) => extension.scope === "global").length,
                  },
                ]}
                onChange={(value) => setScope(value as ScopeFilter)}
              />
              {filtered && (
                <Button variant="ghost" size="xs" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </HStack>
          </Stack>
          <HStack paddingX="lg" paddingY="sm" gap="md" borderBottomWidth="1px" borderColor="border.subtle">
            <Text textStyle="label/XS/medium" color="fg.subtle" flex="1">
              Extension
            </Text>
            <HStack display={{ base: "none", md: "flex" }} gap="md" color="fg.subtle">
              <Text textStyle="label/XS/medium" w="28">
                Visibility
              </Text>
              <Text textStyle="label/XS/medium" w="28">
                Scope
              </Text>
              <Text textStyle="label/XS/medium" w="16" textAlign="end">
                Enabled
              </Text>
            </HStack>
          </HStack>
        </Stack>
      }
    >
      <Stack gap="0">
        {groups
          .filter((group) => group.extensions.length > 0)
          .flatMap((group) => [
            <HStack
              key={group.title}
              paddingX="lg"
              paddingY="sm"
              gap="sm"
              bg="bg.subtle"
              borderBottomWidth="1px"
              borderColor="border.subtle"
              data-testid={`extension-group-${group.title.toLowerCase()}`}
            >
              <Text as="h2" textStyle="label/XS/medium">
                {group.title}
              </Text>
              <Badge variant="number" size="xs">
                {group.extensions.length}
              </Badge>
            </HStack>,
            ...group.extensions.map((extension) => (
              <ExtensionListRow
                key={extension.id}
                extension={extension}
                onOpen={() => setSelectedId(extension.id)}
                onToggle={(enabled) => toggle(extension.id, enabled)}
              />
            )),
          ])}
      </Stack>
      {visible.length === 0 && (
        <Stack padding="lg" gap="md" align="start">
          <Text textStyle="label/S/regular" color="fg.muted">
            No extensions match these filters.
          </Text>
          <Button variant="outline" size="xs" onClick={clearFilters}>
            Clear filters
          </Button>
        </Stack>
      )}
    </PageContentLayout>
  );
};
