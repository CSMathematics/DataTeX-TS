import React, { useState, useEffect, useMemo } from "react";
import {
  Stack,
  TextInput,
  Checkbox,
  Group,
  Text,
  ScrollArea,
  Box,
  ActionIcon,
  Collapse,
  Loader,
  Badge,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faTimes,
  faChevronRight,
  faChevronDown,
  faExchangeAlt,
} from "@fortawesome/free-solid-svg-icons";
import { useDebouncedValue } from "@mantine/hooks";
import {
  searchDatabaseFiles,
  replaceDatabaseFiles,
  SearchMatch,
  SearchResult,
} from "../../services/searchService";
import { useTranslation } from "react-i18next";
import { useDatabaseStore } from "../../stores/databaseStore";
import { FileMatchGroup } from "./FileMatchGroup";

interface SearchPanelProps {
  onOpenFile: (path: string, lineNumber: number) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ onOpenFile }) => {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [fileTypes, setFileTypes] = useState<string[]>([
    "tex",
    "bib",
    "sty",
    "cls",
    "dtx",
    "ins",
  ]);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Replace state
  const [replaceText, setReplaceText] = useState("");
  const [isReplaceOpen, setIsReplaceOpen] = useState(false);

  // Debounce search text
  const [debouncedSearch] = useDebouncedValue(searchText, 300);

  // Get loaded collections from store
  const loadedCollections = useDatabaseStore(
    (state) => state.loadedCollections
  );
  const collectionNames = useMemo(
    () => Array.from(loadedCollections).map((coll) => String(coll)),
    [loadedCollections]
  );

  // Perform search when debounced text changes
  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setResult(null);
      return;
    }

    const performSearch = async () => {
      setIsSearching(true);
      setError(null);

      try {
        const searchResult = await searchDatabaseFiles({
          query: debouncedSearch,
          caseSensitive,
          useRegex,
          fileTypes,
          collections: collectionNames,
          maxResults: 1000,
        });

        setResult(searchResult);
      } catch (err) {
        console.error("Search failed:", err);
        setError(String(err));
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedSearch, caseSensitive, useRegex, fileTypes, collectionNames]);

  const toggleFileType = (type: string) => {
    setFileTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleReplaceAll = async () => {
    if (!searchText || !replaceText) return;

    // Confirm with user
    if (
      !window.confirm(
        t("search.confirmReplace", {
          search: searchText,
          replace: replaceText,
        })
      )
    ) {
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const replaceRes = await replaceDatabaseFiles({
        query: searchText,
        replaceWith: replaceText,
        caseSensitive,
        useRegex,
        fileTypes,
        collections: collectionNames,
        maxResults: 1000,
      });
      // Update result to show empty matches ? Or reload.
      setResult(null);

      // Maybe show a temporary success status
      alert(
        t("search.replaceSuccess", {
          count: replaceRes.total_replacements,
          files: replaceRes.total_files_changed,
        })
      );
    } catch (err) {
      console.error("Replace failed:", err);
      setError(t("search.replaceError", { error: String(err) }));
    } finally {
      setIsSearching(false);
    }
  };

  const allFileTypes = ["tex", "bib", "sty", "cls", "dtx", "ins"];

  return (
    <Stack gap="sm" p="sm" h="100%" style={{ overflow: "hidden" }}>
      {/* Search & Replace Header */}
      <Stack gap={4}>
        <Group gap={4} wrap="nowrap">
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={() => setIsReplaceOpen(!isReplaceOpen)}
            color="gray"
          >
            <FontAwesomeIcon
              icon={isReplaceOpen ? faChevronDown : faChevronRight}
              size="xs"
            />
          </ActionIcon>
          <TextInput
            style={{ flex: 1 }}
            placeholder={t("search.placeholder")}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            leftSection={
              isSearching ? (
                <Loader size="xs" />
              ) : (
                <FontAwesomeIcon icon={faSearch} size="xs" />
              )
            }
            rightSection={
              searchText ? (
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => setSearchText("")}
                  color="gray"
                >
                  <FontAwesomeIcon icon={faTimes} size="xs" />
                </ActionIcon>
              ) : null
            }
          />
        </Group>

        <Collapse in={isReplaceOpen}>
          <Group gap={4} wrap="nowrap">
            <Box w={22} /> {/* Spacer for alignment */}
            <TextInput
              style={{ flex: 1 }}
              placeholder={t("search.replacePlaceholder")}
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              leftSection={<FontAwesomeIcon icon={faExchangeAlt} size="xs" />}
              rightSectionWidth={replaceText ? 52 : 28}
              rightSection={
                <Group gap={2} wrap="nowrap">
                  <ActionIcon
                    variant="subtle"
                    size="xs"
                    onClick={handleReplaceAll}
                    disabled={
                      !searchText ||
                      !replaceText ||
                      (result?.matches.length || 0) === 0
                    }
                    title={t("search.replaceAll")}
                    color="blue"
                  >
                    <FontAwesomeIcon icon={faExchangeAlt} size="xs" />
                  </ActionIcon>
                  {replaceText && (
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      onClick={() => setReplaceText("")}
                      color="gray"
                    >
                      <FontAwesomeIcon icon={faTimes} size="xs" />
                    </ActionIcon>
                  )}
                </Group>
              }
            />
          </Group>
        </Collapse>
      </Stack>

      {/* Options */}
      <Group gap="xs">
        <Checkbox
          label={t("search.case")}
          size="xs"
          checked={caseSensitive}
          onChange={(e) => setCaseSensitive(e.currentTarget.checked)}
        />
        <Checkbox
          label={t("search.regex")}
          size="xs"
          checked={useRegex}
          onChange={(e) => setUseRegex(e.currentTarget.checked)}
        />
      </Group>

      {/* File Type Filters */}
      <Box>
        <Text size="xs" c="dimmed" mb={4}>
          {t("search.fileTypes")}
        </Text>
        <Group gap={4}>
          {allFileTypes.map((type) => (
            <Badge
              key={type}
              size="sm"
              variant={fileTypes.includes(type) ? "filled" : "outline"}
              style={{ cursor: "pointer" }}
              onClick={() => toggleFileType(type)}
            >
              .{type}
            </Badge>
          ))}
        </Group>
      </Box>

      {/* Stats */}
      {result && (
        <Text size="xs" c="dimmed">
          {t("search.stats", {
            matches: result.matches.length,
            files: result.total_files_searched,
            duration: result.search_duration_ms,
          })}
        </Text>
      )}

      {/* Error Display */}
      {error && (
        <Text size="xs" c="red">
          {t("search.errorPrefix", { error })}
        </Text>
      )}

      {/* Results */}
      <ScrollArea style={{ flex: 1 }}>
        {result && result.matches.length > 0 ? (
          <Stack gap="xs">
            {/* Group matches by file */}
            {Object.entries(
              result.matches.reduce((acc, match) => {
                const filePath = match.file_path;
                if (!acc[filePath]) {
                  acc[filePath] = [];
                }
                acc[filePath].push(match);
                return acc;
              }, {} as Record<string, SearchMatch[]>)
            ).map(([filePath, matches]) => (
              <FileMatchGroup
                key={filePath}
                filePath={filePath}
                fileName={matches[0]?.file_name || filePath}
                matches={matches}
                onOpenFile={onOpenFile}
              />
            ))}
          </Stack>
        ) : searchText && !isSearching ? (
          <Text size="sm" c="dimmed" ta="center" mt="md">
            {t("search.noMatches")}
          </Text>
        ) : null}
      </ScrollArea>
    </Stack>
  );
};
