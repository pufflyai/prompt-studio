import { HStack, Stack, Table, Text } from "@chakra-ui/react";
import { Checkbox, SettingsPage } from "@pstdio/ui";
import { CloudIcon } from "../../cloud-label";
import { extensions, type TeamDemo } from "./demo-model";

export const ManagedExtensions = (props: { demo: TeamDemo }) => {
  const { demo } = props;
  return (
    <SettingsPage
      title="Managed extensions"
      icon={<CloudIcon name="package-check" />}
      description={
        <Text color="fg.muted">
          Selected extensions are installed automatically in team projects. Only the team owner can change them.
        </Text>
      }
    >
      <Table.Root size="sm" variant="line">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Extension</Table.ColumnHeader>
            <Table.ColumnHeader>Version</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">Managed</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {extensions.map((extension) => (
            <Table.Row key={extension.id}>
              <Table.Cell py="sm">
                <HStack gap="sm">
                  <CloudIcon name={extension.icon} />
                  <Stack gap="0">
                    <Text textStyle="label/M/medium">{extension.name}</Text>
                    <Text color="fg.muted" textStyle="label/S/regular">
                      {extension.publisher}
                    </Text>
                  </Stack>
                </HStack>
              </Table.Cell>
              <Table.Cell color="fg.muted">{extension.version}</Table.Cell>
              <Table.Cell textAlign="end">
                <Checkbox
                  inputProps={{ "aria-label": `Manage ${extension.name}` }}
                  checked={demo.managed.includes(extension.id)}
                  disabled={!demo.owner}
                  onCheckedChange={({ checked }) => demo.setManaged(extension.id, checked === true)}
                />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </SettingsPage>
  );
};
