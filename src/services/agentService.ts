import { useDatabaseStore } from "../stores/databaseStore";
import { useAIStore } from "../stores/aiStore";
import { invoke } from "@tauri-apps/api/core";
import { readTextFile } from "@tauri-apps/plugin-fs";

export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  avatar?: string;
  isBuiltIn?: boolean;
}

// Built-in Agents Imports
import latexExpertConfig from "../assets/agents/latex_expert/config.json";
import latexExpertPrompt from "../assets/agents/latex_expert/prompt.md?raw";
import preambleExpertConfig from "../assets/agents/preamble_expert/config.json";
import preambleExpertPrompt from "../assets/agents/preamble_expert/prompt.md?raw";
import librarianConfig from "../assets/agents/librarian/config.json";
import librarianPrompt from "../assets/agents/librarian/prompt.md?raw";

export const getBuiltInAgents = (): Agent[] => {
  return [
    {
      ...latexExpertConfig,
      systemPrompt: latexExpertPrompt,
    },
    {
      ...preambleExpertConfig,
      systemPrompt: preambleExpertPrompt,
    },
    {
      ...librarianConfig,
      systemPrompt: librarianPrompt,
    },
  ];
};

export interface Tool {
  name: string;
  description: string;
  parameters: string; // JSON schema description for the AI
  execute: (args: any) => Promise<string>;
}

// --- Tool Implementations ---

export const tools: Record<string, Tool> = {
  list_collections: {
    name: "list_collections",
    description: "List all available document collections (databases).",
    parameters: "{}",
    execute: async () => {
      const collections = useDatabaseStore.getState().collections;
      return JSON.stringify(collections.map((c) => c.name));
    },
  },
  list_files: {
    name: "list_files",
    description: "List all files in a specific collection.",
    parameters:
      '{ "collection_name": "Name of the collection to list files from" }',
    execute: async ({ collection_name }) => {
      try {
        // We use the store's getter or directly invoke/filter resources if loaded
        // Ideally we shouldn't rely on what's currently "loaded" in the UI view,
        // but fetching fresh is safer for an agent.
        const resources = await invoke<any[]>(
          "get_resources_by_collection_cmd",
          {
            collection: collection_name,
          },
        );
        return JSON.stringify(
          resources.map((r) => ({
            name: r.title || r.path,
            id: r.id,
            path: r.path,
          })),
        );
      } catch (e: any) {
        return `Error listing files: ${e.message}`;
      }
    },
  },
  read_file: {
    name: "read_file",
    description: "Read the content of a file given its absolute path.",
    parameters: '{ "path": "Absolute path of the file" }',
    execute: async ({ path }) => {
      try {
        const content = await readTextFile(path);
        // Truncate if too long? For now let's hope context window is enough.
        return (
          content.slice(0, 5000) +
          (content.length > 5000 ? "\n...[TRUNCATED]" : "")
        );
      } catch (e: any) {
        return `Error reading file: ${e.message}`;
      }
    },
  },
  write_file: {
    name: "write_file",
    description: "Overwrite the content of a file given its absolute path.",
    parameters:
      '{ "path": "Absolute path of the file", "content": "New content of the file" }',
    execute: async ({ path, content }) => {
      // Trigger the UI to show the approval dialog
      useAIStore.getState().setPendingWrite({ path, content });

      // Return a message to the AI so it knows it's waiting
      return `Action PENDING_APPROVAL: I have drafted the changes for ${path}. The user has been prompted to review and approve them. Please wait for confirmation.`;
    },
  },
};

// --- Agent Loop Helper ---

/**
 * Constructs the system prompt with tool definitions.
 */
export const getSystemPromptWithTools = (agent: Agent): string => {
  const toolDefs = Object.values(tools)
    .map((t) => `- ${t.name}: ${t.description}\n  Parameters: ${t.parameters}`)
    .join("\n");

  return `${agent.systemPrompt}

You have access to the following tools:
${toolDefs}

To use a tool, your response must be ONLY a JSON object in this format:
{ "tool": "tool_name", "args": { ... } }

If you do not need to use a tool, just respond normally with text.
`;
};
