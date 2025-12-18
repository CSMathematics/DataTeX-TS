import React from 'react';
import { 
  Container, Title, Text, SimpleGrid, Card, Group, ThemeIcon, 
  UnstyledButton, Stack, Divider, ScrollArea, Box, Badge
} from '@mantine/core';
import { 
  FilePlus, Wand2, LayoutTemplate, FileText, ChevronRight 
} from 'lucide-react';
import { DOCUMENT_TEMPLATES } from '../../templates/documentTemplates';

interface StartPageProps {
  onCreateEmpty: () => void;
  onOpenWizard: () => void;
  onCreateFromTemplate: (code: string) => void;
}

export const StartPage: React.FC<StartPageProps> = ({ 
  onCreateEmpty, 
  onOpenWizard, 
  onCreateFromTemplate 
}) => {

  const ActionCard = ({ icon: Icon, color, title, description, onClick }: any) => (
    <UnstyledButton onClick={onClick} style={{ width: '100%' }}>
      <Card shadow="sm" padding="lg" radius="md" withBorder bg="dark.7" style={{ 
          transition: 'transform 0.2s, border-color 0.2s', 
          height: '100%',
          ':hover': { transform: 'translateY(-2px)', borderColor: 'var(--mantine-color-blue-6)' } 
      }}>
        <Group align="start" wrap="nowrap">
            <ThemeIcon size={40} radius="md" variant="light" color={color}>
                <Icon size={24} />
            </ThemeIcon>
            <Stack gap={4} style={{ flex: 1 }}>
                <Text size="md" fw={700} c="white">{title}</Text>
                <Text size="xs" c="dimmed">{description}</Text>
            </Stack>
        </Group>
      </Card>
    </UnstyledButton>
  );

  return (
    <ScrollArea h="100%" bg="dark.8">
      <Container size="lg" py={50}>
        <Stack gap="xl">
          
          <Box>
            <Title order={1} mb="xs" c="white">Welcome to DataTex</Title>
            <Text c="dimmed" size="lg">Create a new LaTeX document to get started.</Text>
          </Box>

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
            <ActionCard 
                icon={FilePlus} color="gray" 
                title="Empty File" 
                description="Start from scratch with a blank document."
                onClick={onCreateEmpty}
            />
            <ActionCard 
                icon={Wand2} color="violet" 
                title="Preamble Wizard" 
                description="Configure page settings, packages, and fonts step-by-step."
                onClick={onOpenWizard}
            />
            <ActionCard 
                icon={LayoutTemplate} color="blue" 
                title="Templates" 
                description="Start from a predefined template below."
                onClick={() => {}} // Just visual grouping
            />
          </SimpleGrid>

          <Divider label="AVAILABLE TEMPLATES" labelPosition="left" my="md" />

          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            {DOCUMENT_TEMPLATES.map(tmpl => (
                <UnstyledButton key={tmpl.id} onClick={() => onCreateFromTemplate(tmpl.code)}>
                    <Card withBorder padding="sm" bg="dark.7" h="100%" style={{ transition: '0.2s', ':hover': { borderColor: 'var(--mantine-color-blue-6)' } }}>
                        <Group justify="space-between" mb="xs">
                            <ThemeIcon variant="transparent" color="blue"><FileText size={20}/></ThemeIcon>
                            <Badge size="xs" variant="outline">{tmpl.id}</Badge>
                        </Group>
                        <Text fw={600} size="sm" mb={4} c="gray.3">{tmpl.name}</Text>
                        <Text c="dimmed" size="xs" lineClamp={2}>{tmpl.description}</Text>
                    </Card>
                </UnstyledButton>
            ))}
          </SimpleGrid>

        </Stack>
      </Container>
    </ScrollArea>
  );
};