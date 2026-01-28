import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";

import { Agent, getBuiltInAgents } from "../services/agentService";

export type AIProviderId = "mock" | "openai" | "gemini" | "ollama";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface PendingWrite {
  path: string;
  content: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

interface AIState {
  provider: AIProviderId;
  openaiKey: string;
  openaiModel: string;
  geminiKey: string;
  geminiModel: string;
  ollamaUrl: string;
  ollamaModel: string;

  // Agents
  builtInAgents: Agent[];
  agents: Agent[];
  activeAgentId: string | null;
  pendingWrite: PendingWrite | null;

  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;

  setProvider: (provider: AIProviderId) => void;
  setOpenAIKey: (key: string) => void;
  setOpenAIModel: (model: string) => void;
  setGeminiKey: (key: string) => void;
  setGeminiModel: (model: string) => void;
  setOllamaUrl: (url: string) => void;
  setOllamaModel: (model: string) => void;

  createAgent: (agent: Agent) => void;
  updateAgent: (agent: Agent) => void;
  deleteAgent: (id: string) => void;
  setActiveAgent: (id: string | null) => void;
  setPendingWrite: (write: PendingWrite | null) => void;

  // Conversation Actions
  createConversation: (title?: string) => string;
  deleteConversation: (id: string) => void;
  setActiveConversation: (id: string) => void;
  updateConversationTitle: (id: string, title: string) => void;

  // Active Conversation Message Actions
  getMessages: () => Message[]; // Helper to get current messages
  addMessage: (msg: Message) => void;
  setMessages: (msgs: Message[]) => void;
  deleteMessage: (index: number) => void;
  clearMessages: () => void;
}

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      provider: "mock",
      openaiKey: "",
      openaiModel: "gpt-4o",
      geminiKey: "",
      geminiModel: "gemini-1.5-flash",
      ollamaUrl: "http://localhost:11434",
      ollamaModel: "llama3",

      builtInAgents: getBuiltInAgents(),
      agents: [],
      activeAgentId: "latex_expert",
      pendingWrite: null,

      conversations: [],
      activeConversationId: null,

      setProvider: (provider) => set({ provider }),
      setOpenAIKey: (openaiKey) => set({ openaiKey }),
      setOpenAIModel: (openaiModel) => set({ openaiModel }),
      setGeminiKey: (geminiKey) => set({ geminiKey }),
      setGeminiModel: (geminiModel) => set({ geminiModel }),
      setOllamaUrl: (ollamaUrl) => set({ ollamaUrl }),
      setOllamaModel: (ollamaModel) => set({ ollamaModel }),

      createAgent: (agent) =>
        set((state) => ({ agents: [...state.agents, agent] })),
      updateAgent: (agent) =>
        set((state) => ({
          agents: state.agents.map((a) => (a.id === agent.id ? agent : a)),
        })),
      deleteAgent: (id) =>
        set((state) => ({
          agents: state.agents.filter((a) => a.id !== id),
          activeAgentId:
            state.activeAgentId === id ? null : state.activeAgentId,
        })),
      setActiveAgent: (id) => set({ activeAgentId: id }),
      setPendingWrite: (write) => set({ pendingWrite: write }),

      createConversation: (title) => {
        const id = uuidv4();
        const newConv: Conversation = {
          id,
          title: title || "New Chat",
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({
          conversations: [newConv, ...state.conversations],
          activeConversationId: id,
        }));
        return id;
      },

      deleteConversation: (id) =>
        set((state) => {
          const newConvs = state.conversations.filter((c) => c.id !== id);
          let newActiveId = state.activeConversationId;
          if (state.activeConversationId === id) {
            newActiveId = newConvs.length > 0 ? newConvs[0].id : null;
          }
          return {
            conversations: newConvs,
            activeConversationId: newActiveId,
          };
        }),

      setActiveConversation: (id) => set({ activeConversationId: id }),

      updateConversationTitle: (id, title) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, title } : c,
          ),
        })),

      getMessages: () => {
        const state = get();
        const active = state.conversations.find(
          (c) => c.id === state.activeConversationId,
        );
        return active ? active.messages : [];
      },

      addMessage: (msg) =>
        set((state) => {
          if (!state.activeConversationId) return {}; // Should check if we need to auto-create? Better to handle in UI or auto-create here.

          // If no active conversation, create one?
          // For now, let's assume one exists or we create one on the fly if strictly necessary,
          // but strictly adhering to explicit creation is better.
          // However, to mimic previous behavior where specific ID wasn't needed:
          let activeId = state.activeConversationId;
          let conversations = state.conversations;

          if (!activeId) {
            const id = uuidv4();
            const newConv: Conversation = {
              id,
              title: "New Chat",
              messages: [msg],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            return {
              conversations: [newConv, ...conversations],
              activeConversationId: id,
            };
          }

          return {
            conversations: state.conversations.map((c) =>
              c.id === activeId
                ? {
                    ...c,
                    messages: [...c.messages, msg],
                    updatedAt: Date.now(),
                  }
                : c,
            ),
          };
        }),

      setMessages: (msgs) =>
        set((state) => {
          if (!state.activeConversationId) return {};
          return {
            conversations: state.conversations.map((c) =>
              c.id === state.activeConversationId
                ? { ...c, messages: msgs, updatedAt: Date.now() }
                : c,
            ),
          };
        }),

      deleteMessage: (index) =>
        set((state) => {
          if (!state.activeConversationId) return {};
          return {
            conversations: state.conversations.map((c) =>
              c.id === state.activeConversationId
                ? {
                    ...c,
                    messages: c.messages.filter((_, i) => i !== index),
                    updatedAt: Date.now(),
                  }
                : c,
            ),
          };
        }),

      clearMessages: () =>
        set((state) => {
          if (!state.activeConversationId) return {};
          return {
            conversations: state.conversations.map((c) =>
              c.id === state.activeConversationId
                ? { ...c, messages: [], updatedAt: Date.now() }
                : c,
            ),
          };
        }),
    }),
    {
      name: "datatex-ai-storage",
      version: 1, // Increment version
      partialize: (state) => ({
        ...state,
        builtInAgents: undefined,
      }),
      migrate: (persistedState: any, version) => {
        if (version === 0 || !version) {
          // Migration from version 0 (or no version)
          // Old state had `messages: Message[]`
          const oldMessages = persistedState.messages || [];
          const newId = uuidv4();

          const defaultConv: Conversation = {
            id: newId,
            title: "Previous Chat",
            messages: oldMessages,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          return {
            ...persistedState,
            conversations: [defaultConv],
            activeConversationId: newId,
            // Clean up old key if possible, though Zustand merge might keep it if not careful.
            // But we return the new state which adheres to the new shape (mostly).
          };
        }
        return persistedState;
      },
    },
  ),
);
