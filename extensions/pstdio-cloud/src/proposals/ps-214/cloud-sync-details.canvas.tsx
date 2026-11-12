import { Button, HStack, Stack, Text } from '@chakra-ui/react';
import { AlertMessage, ScrollArea, SimpleCard } from '@pstdio/ui';
import { useState } from 'react';

export default { title: 'Proposals/PS-214 Cloud sync details', description: 'Synthetic data. Explore transfers, waiting, offline, discovery, and completion without changing a project.' };

const modes = ['Downloading', 'Waiting', 'Offline', 'Discovering', 'Synced'] as const;
type Mode = typeof modes[number];
const samples = [
  { name: 'notes/meeting-notes.md', source: 'Notes', progress: '48 KB of 80 KB', status: 'Downloading' },
  { name: 'tickets/RC-1.md', source: 'Planner', progress: '12 KB of 12 KB', status: 'Complete' },
  { name: 'Session draft', source: 'Sessions', progress: '320 B', status: 'Queued' },
];

export const DownloadDetails = () => {
  const [mode, setMode] = useState<Mode>('Waiting');
  const [tab, setTab] = useState('Files');
  const [retry, setRetry] = useState(false);
  const active = retry || mode === 'Downloading';
  const label = retry ? 'Retrying Sessions…' : mode === 'Waiting' ? 'Sync needs attention' : mode;
  return (
    <Stack p="md" gap="md" height="full">
      <HStack gap="xs" flexWrap="wrap" aria-label="Preview state">
        {modes.map(value => <Button key={value} size="xs" variant="outline" aria-pressed={mode === value} onClick={() => { setMode(value); setRetry(false); }}>{value}</Button>)}
      </HStack>
      <SimpleCard>
        <Stack p="md" gap="md">
          <HStack justify="space-between"><Text textStyle="label/M/medium">Cloud sync</Text><Text>{label}</Text></HStack>
          {mode === 'Waiting' && !retry && <AlertMessage status="warning">Sessions has made no progress for 9 hours. Last action: receiving session records.</AlertMessage>}
          {mode === 'Offline' && <AlertMessage status="warning">Offline. Transfers resume when this device reconnects.</AlertMessage>}
          {mode === 'Discovering' && <Text>Checking what this project needs. 39 sync documents ready; total not known yet.</Text>}
          {mode === 'Synced' && <Text>Everything needed on this device is ready. Completed in 12 seconds.</Text>}
          <HStack gap="xs">
            {['Files', 'Project data'].map(value => <Button key={value} size="sm" variant="outline" aria-pressed={tab === value} onClick={() => setTab(value)}>{value}</Button>)}
          </HStack>
          <ScrollArea>
            <Stack gap="sm">
              {tab === 'Files' ? (active ? samples.map(file => (
                <Stack key={file.name} gap="xs">
                  <HStack justify="space-between"><Text>{file.name}</Text><Text>{file.status}</Text></HStack>
                  <Text color="fg.muted">{file.source} · Cloud → This device · {file.progress}</Text>
                </Stack>
              )) : <Text color="fg.muted">No files are downloading{mode === 'Synced' ? '.' : '. Open Project data to see what is pending.'}</Text>) : (
                <Stack gap="sm">
                  <HStack justify="space-between"><Text>Sessions</Text><Text>{mode === 'Synced' ? 'Ready' : active ? 'Receiving records' : mode === 'Offline' ? 'Waiting for connection' : 'Waiting'}</Text></HStack>
                  <Text color="fg.muted">2 sync documents ready · Total {mode === 'Synced' ? '3' : 'not known yet'}</Text>
                  {['Project information', 'Notes', 'Planner', 'Other tools'].map(name => <HStack key={name} justify="space-between"><Text>{name}</Text><Text color="fg.success">Ready</Text></HStack>)}
                </Stack>
              )}
            </Stack>
          </ScrollArea>
          {mode === 'Waiting' && !retry && <Button size="sm" variant="outline" alignSelf="flex-start" onClick={() => {setRetry(true); setTab('Project data');}}>Retry Sessions</Button>}
          {retry && <Text color="fg.muted">Retrying this source. Other tools stay available.</Text>}
        </Stack>
      </SimpleCard>
    </Stack>
  );
};
