import { create } from "zustand";
import { persist } from "zustand/middleware";

import { Agent, getBuiltInAgents } from "../services/agentService";

export type AIProviderId = "mock" | "openai" | "gemini" | "ollama";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
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

  // Chat History
  messages: Message[];

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

  addMessage: (msg: Message) => void;
  setMessages: (msgs: Message[]) => void;
  deleteMessage: (index: number) => void;
  clearMessages: () => void;
}

export const useAIStore = create<AIState>()(
  persist(
    (set) => ({
      provider: "mock",
      openaiKey: "",
      openaiModel: "gpt-4o",
      geminiKey: "",
      geminiModel: "gemini-1.5-flash",
      ollamaUrl: "http://localhost:11434",
      ollamaModel: "llama3",
      messages: [],

      builtInAgents: getBuiltInAgents(),
      agents: [],
      activeAgentId: null,

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

      addMessage: (msg) =>
        set((state) => ({ messages: [...state.messages, msg] })),
      setMessages: (msgs) => set({ messages: msgs }),
      deleteMessage: (index) =>
        set((state) => ({
          messages: state.messages.filter((_, i) => i !== index),
        })),
      clearMessages: () => set({ messages: [] }),
    }),
    {
      name: "datatex-ai-storage",
      partialize: (state) => ({
        ...state,
        builtInAgents: undefined, // Do not persist built-in agents
      }),
    },
  ),
);
