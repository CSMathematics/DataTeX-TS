import React from 'react';
import { 
  Container, Title, Text, SimpleGrid, Card, Group, ThemeIcon, 
  UnstyledButton, Stack, Divider, ScrollArea, Box, Badge
} from '@mantine/core';
import { 
  FilePlus, Wand2, ChevronRight, Clock, ExternalLink
} from 'lucide-react';
import { DOCUMENT_TEMPLATES } from '../../templates/documentTemplates';

interface StartPageProps {
  onCreateEmpty: () => void;
  onOpenWizard: () => void;
  onCreateFromTemplate: (code: string) => void;
  recentProjects?: string[];
  onOpenRecent?: (path: string) => void;
}

export const StartPage: React.FC<StartPageProps> = ({ 
  onCreateEmpty, 
  onOpenWizard, 
  onCreateFromTemplate,
  recentProjects = [],
  onOpenRecent
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

  const QuickLink = ({ title, url }: { title: string, url: string }) => (
      <UnstyledButton onClick={() => window.open(url, '_blank')} style={{ width: '100%' }}>
          <Group justify="space-between" px="sm" py="xs" style={{ borderRadius: 8, transition: '0.2s', ':hover': { backgroundColor: 'var(--mantine-color-dark-6)' } }}>
              <Group gap="xs">
                  <ThemeIcon variant="transparent" size="sm" color="gray"><ExternalLink size={14}/></ThemeIcon>
                  <Text size="sm" c="gray.3">{title}</Text>
              </Group>
              <ChevronRight size={14} color="#5c5f66" />
          </Group>
      </UnstyledButton>
  );

  return (
    <ScrollArea h="100%" bg="dark.8">
      <Container size="xl" py={50}>
        <Stack gap={40}>
          
          {/* Hero Section */}
          <Box style={{
              background: 'linear-gradient(45deg, var(--mantine-color-blue-9), var(--mantine-color-dark-8))',
              padding: '40px', borderRadius: '16px', border: '1px solid var(--mantine-color-dark-6)'
          }}>
            <Group align="flex-start" justify="space-between">
                <Box>
                    <Title order={1} mb="xs" c="white" style={{ fontSize: '2.5rem' }}>Welcome to DataTex</Title>
                    <Text c="gray.3" size="lg" mb="xl" maw={600}>
                        The modern, lightweight LaTeX environment designed for speed and efficiency.
                        Start a new project or continue where you left off.
                    </Text>
                    <Group>
                        <UnstyledButton onClick={() => window.open('https://www.latex-project.org/help/documentation/', '_blank')}>
                            <Badge variant="gradient" gradient={{ from: 'blue', to: 'cyan' }} size="lg" style={{ cursor: 'pointer' }}>Documentation</Badge>
                        </UnstyledButton>
                        <UnstyledButton onClick={() => window.open('https://github.com/', '_blank')}>
                            <Badge variant="outline" color="gray" size="lg" style={{ cursor: 'pointer' }}>GitHub</Badge>
                        </UnstyledButton>
                    </Group>
                </Box>
                <Wand2 size={120} style={{ opacity: 0.1, color: 'white' }} />
            </Group>
          </Box>

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xl">
            {/* Main Actions - Takes up 2 columns on medium screens */}
            <Stack gap="lg" style={{ gridColumn: 'span 2' }}>
                <Text fw={700} c="dimmed" size="sm" tt="uppercase" style={{ letterSpacing: 1 }}>Get Started</Text>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <ActionCard
                        icon={FilePlus} color="gray"
                        title="Empty File"
                        description="Start from scratch with a blank document."
                        onClick={onCreateEmpty}
                    />
                    <ActionCard
                        icon={Wand2} color="violet"
                        title="Preamble Wizard"
                        description="Configure page settings, packages, and fonts."
                        onClick={onOpenWizard}
                    />
                </SimpleGrid>

                <Divider label="RECENT PROJECTS" labelPosition="left" my="xs" />

                {recentProjects.length > 0 ? (
                    <Card withBorder bg="dark.7" p={0}>
                        <Stack gap={0}>
                            {recentProjects.map((path, idx) => (
                                <UnstyledButton
                                    key={idx}
                                    onClick={() => onOpenRecent && onOpenRecent(path)}
                                    p="md"
                                    style={{
                                        borderBottom: idx < recentProjects.length - 1 ? '1px solid var(--mantine-color-dark-6)' : 'none',
                                        transition: 'background-color 0.2s',
                                        ':hover': { backgroundColor: 'var(--mantine-color-dark-6)' }
                                    }}
                                >
                                    <Group>
                                        <ThemeIcon color="yellow" variant="light" size="lg"><Clock size={18}/></ThemeIcon>
                                        <Box style={{ flex: 1, overflow: 'hidden' }}>
                                            <Text size="sm" fw={500} c="white" truncate>{path.split(/[/\\]/).pop()}</Text>
                                            <Text size="xs" c="dimmed" truncate>{path}</Text>
                                        </Box>
                                        <ChevronRight size={16} color="gray" />
                                    </Group>
                                </UnstyledButton>
                            ))}
                        </Stack>
                    </Card>
                ) : (
                    <Text c="dimmed" fs="italic" size="sm">No recent projects found.</Text>
                )}
            </Stack>

            {/* Sidebar Column - Quick Links & Templates */}
            <Stack gap="lg">
                <Text fw={700} c="dimmed" size="sm" tt="uppercase" style={{ letterSpacing: 1 }}>Quick Resources</Text>
                <Card withBorder bg="dark.7" padding="sm">
                    <Stack gap={4}>
                        <QuickLink title="LaTeX Cheatsheet" url="https://wch.github.io/latexsheet/latexsheet.pdf" />
                        <QuickLink title="CTAN Package Search" url="https://ctan.org/" />
                        <QuickLink title="Detexify (Symbols)" url="https://detexify.kirelabs.org/classify.html" />
                        <QuickLink title="TikZ Examples" url="https://texample.net/tikz/examples/" />
                    </Stack>
                </Card>

                <Text fw={700} c="dimmed" size="sm" tt="uppercase" mt="md" style={{ letterSpacing: 1 }}>Templates</Text>
                <Stack gap="xs">
                    {DOCUMENT_TEMPLATES.slice(0, 3).map(tmpl => (
                        <UnstyledButton key={tmpl.id} onClick={() => onCreateFromTemplate(tmpl.code)}>
                            <Card withBorder padding="xs" bg="dark.7" style={{ transition: '0.2s', ':hover': { borderColor: 'var(--mantine-color-blue-6)' } }}>
                                <Group justify="space-between" mb={4}>
                                    <Text fw={600} size="xs" c="gray.3">{tmpl.name}</Text>
                                    <Badge size="xs" variant="outline">{tmpl.id}</Badge>
                                </Group>
                                <Text c="dimmed" size="xs" lineClamp={1}>{tmpl.description}</Text>
                            </Card>
                        </UnstyledButton>
                    ))}
                    <UnstyledButton onClick={() => {}} style={{ textAlign: 'center' }}>
                        <Text size="xs" c="blue" td="underline">View all templates</Text>
                    </UnstyledButton>
                </Stack>
            </Stack>

          </SimpleGrid>

        </Stack>
      </Container>
    </ScrollArea>
  );
};
