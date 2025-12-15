import React, { useState, useEffect } from 'react';
import { 
  Table, ScrollArea, Text, LoadingOverlay, Box, Group, Button, 
  TextInput, Pagination 
} from '@mantine/core';
import { Search, RefreshCw, Database } from 'lucide-react';

// Τύπος για τα δεδομένα (Mock ή Real)
type RowData = Record<string, any>;

interface TableDataViewProps {
  tableName: string;
  dbPath?: string; // Προαιρετικό για τώρα (αν είχαμε πολλά DBs)
}

export const TableDataView: React.FC<TableDataViewProps> = ({ tableName }) => {
  const [data, setData] = useState<RowData[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  // --- MOCK DATA GENERATOR (Για να δουλεύει στον browser) ---
  const fetchMockData = () => {
    setLoading(true);
    setTimeout(() => {
      // Δημιουργία ψεύτικων δεδομένων ανάλογα με το όνομα του πίνακα
      const mockCols = ['id', 'title', 'created_at', 'tags'];
      const mockRows = Array.from({ length: 15 }).map((_, i) => ({
        id: i + 1 + (page - 1) * 15,
        title: `${tableName} Item ${i + 1}`,
        created_at: new Date().toISOString().split('T')[0],
        tags: i % 2 === 0 ? 'algebra, math' : 'geometry'
      }));
      
      setColumns(mockCols);
      setData(mockRows);
      setLoading(false);
    }, 600);
  };

  // --- REAL TAURI SQL FETCH (Σχολιασμένο για μελλοντική χρήση) ---
  /*
  const fetchRealData = async () => {
    try {
      setLoading(true);
      const { default: Database } = await import('@tauri-apps/plugin-sql');
      const db = await Database.load('sqlite:test.db'); // Θα πρέπει να περνιέται δυναμικά
      const result = await db.select(`SELECT * FROM ${tableName} LIMIT 50 OFFSET ${(page-1)*50}`);
      if (result.length > 0) {
        setColumns(Object.keys(result[0]));
        setData(result);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  */

  useEffect(() => {
    fetchMockData();
    // fetchRealData(); // Uncomment when running in Tauri
  }, [tableName, page]);

  return (
    <Box h="100%" style={{ display: 'flex', flexDirection: 'column' }} p="md" bg="dark.8">
      
      {/* Toolbar */}
      <Group mb="md" justify="space-between">
        <Group>
            <Database size={20} color="#69db7c" />
            <Text size="lg" fw={700} c="gray.3">Table: <Text span c="white">{tableName}</Text></Text>
        </Group>
        <Group>
            <TextInput 
                placeholder="Search SQL..." 
                leftSection={<Search size={14}/>} 
                size="xs" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
            <Button variant="light" size="xs" leftSection={<RefreshCw size={14}/>} onClick={fetchMockData}>
                Refresh
            </Button>
        </Group>
      </Group>

      {/* Table Area */}
      <Box style={{ flex: 1, position: 'relative', overflow: 'hidden', border: '1px solid #373A40', borderRadius: 4 }} bg="dark.9">
        <LoadingOverlay visible={loading} />
        <ScrollArea h="100%">
            <Table stickyHeader striped highlightOnHover>
                <Table.Thead bg="dark.6">
                    <Table.Tr>
                        {columns.map(col => (
                            <Table.Th key={col} style={{ whiteSpace: 'nowrap', color: '#ccc' }}>{col.toUpperCase()}</Table.Th>
                        ))}
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {data.map((row, rowIndex) => (
                        <Table.Tr key={rowIndex}>
                            {columns.map(col => (
                                <Table.Td key={`${rowIndex}-${col}`} style={{ whiteSpace: 'nowrap', color: '#999' }}>
                                    {row[col]}
                                </Table.Td>
                            ))}
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
        </ScrollArea>
      </Box>

      {/* Pagination */}
      <Group justify="flex-end" mt="md">
         <Pagination total={10} value={page} onChange={setPage} size="sm" />
      </Group>
    </Box>
  );
};