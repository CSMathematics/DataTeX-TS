import { useAIStore, Message } from "../stores/aiStore";

// --- Interface Update ---
export interface AIProvider {
  id: string;
  name: string;
  chat(messages: Message[]): Promise<string>;
  explainError(log: string): Promise<string>;
  getModels?(): Promise<string[]>; // Optional for now to maintain compatibility with existing
}

// --- Mock Provider ---
export const mockAIProvider: AIProvider = {
  id: "mock",
  name: "Mock AI (Debug)",
  chat: async (_messages) => {
    // ... existing implementation ...
    return new Promise((resolve) =>
      setTimeout(() => resolve("Mock Response"), 1000),
    );
  },
  explainError: async () => "Mock Explanation",
  getModels: async () => ["mock-model-1", "mock-model-2"],
};

// --- OpenAI Provider ---
class OpenAIProvider implements AIProvider {
  id = "openai";
  name = "OpenAI";
  get apiKey() {
    return useAIStore.getState().openaiKey;
  }
  get model() {
    return useAIStore.getState().openaiModel;
  }

  async getModels(): Promise<string[]> {
    if (!this.apiKey) return [];
    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!response.ok) throw new Error("Failed to fetch OpenAI models");
      const data = await response.json();
      const models = data.data
        .filter((m: any) => m.id.includes("gpt")) // Filter for relevant models
        .map((m: any) => m.id)
        .sort();
      return models;
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  // ... existing chat & explainError ...
  async chat(messages: Message[]): Promise<string> {
    // ... existing implementation from file ...
    if (!this.apiKey) throw new Error("OpenAI API Key is missing.");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, messages: messages }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "OpenAI request failed");
    }
    const data = await response.json();
    return data.choices[0]?.message?.content || "";
  }

  async explainError(log: string): Promise<string> {
    const messages: Message[] = [
      {
        role: "system",
        content:
          "You are a LaTeX expert. Explain the following error log concisely and provide a fix.",
      },
      { role: "user", content: log },
    ];
    return this.chat(messages);
  }
}

// --- Gemini Provider ---
class GeminiProvider implements AIProvider {
  id = "gemini";
  name = "Google Gemini";
  get apiKey() {
    return useAIStore.getState().geminiKey;
  }
  get model() {
    return useAIStore.getState().geminiModel || "gemini-1.5-flash";
  }

  async getModels(): Promise<string[]> {
    if (!this.apiKey) return [];
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`,
      );
      if (!response.ok) throw new Error("Failed to fetch Gemini models");
      const data = await response.json();
      const models = data.models
        .filter((m: any) =>
          m.supportedGenerationMethods?.includes("generateContent"),
        )
        .map((m: any) => m.name.replace("models/", "")) // Remove 'models/' prefix
        .sort();
      return models;
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  // ... existing chat & explainError ...
  async chat(messages: Message[]): Promise<string> {
    // ... existing implementation ...
    if (!this.apiKey) throw new Error("Gemini API Key is missing.");
    const contents = messages
      .map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      }))
      .filter((c) => c.role !== "system"); // Simple filter

    const systemMsg = messages.find((m) => m.role === "system");
    if (systemMsg && contents.length > 0) {
      contents[0].parts[0].text = `[System: ${systemMsg.content}]\n\n${contents[0].parts[0].text}`;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "Gemini request failed");
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  async explainError(log: string): Promise<string> {
    return this.chat([
      { role: "system", content: "You are a LaTeX expert." },
      { role: "user", content: log },
    ]);
  }
}

// --- Ollama Provider ---
class OllamaProvider implements AIProvider {
  id = "ollama";
  name = "Ollama (Local)";
  get url() {
    return useAIStore.getState().ollamaUrl;
  }
  get model() {
    return useAIStore.getState().ollamaModel;
  }

  async getModels(): Promise<string[]> {
    try {
      const endpoint = `${this.url.replace(/\/$/, "")}/api/tags`;
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error("Failed to fetch Ollama models");
      const data = await response.json();
      const models = data.models.map((m: any) => m.name).sort();
      return models;
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  // ... existing chat & explainError ...
  async chat(messages: Message[]): Promise<string> {
    const endpoint = `${this.url.replace(/\/$/, "")}/api/chat`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, messages, stream: false }),
    });
    if (!response.ok)
      throw new Error(`Ollama request failed: ${response.statusText}`);
    const data = await response.json();
    return data.message?.content || "";
  }

  async explainError(log: string): Promise<string> {
    return this.chat([
      { role: "system", content: "Explain error" },
      { role: "user", content: log },
    ]);
  }
}

// --- Dynamic Provider Wrapper ---
export const aiProxy = {
  getProvider(): AIProvider {
    const { provider } = useAIStore.getState();
    switch (provider) {
      case "openai":
        return new OpenAIProvider();
      case "gemini":
        return new GeminiProvider();
      case "ollama":
        return new OllamaProvider();
      case "mock":
      default:
        return mockAIProvider;
    }
  },

  async chat(messages: Message[]): Promise<string> {
    const { activeAgentId, agents, builtInAgents } = useAIStore.getState();
    let activeAgent =
      agents.find((a) => a.id === activeAgentId) ||
      builtInAgents.find((a) => a.id === activeAgentId);

    // FIX: If no agent is selected (null), fallback to 'latex_expert' so tools are available
    if (!activeAgent) {
      activeAgent =
        builtInAgents.find((a) => a.id === "latex_expert") || builtInAgents[0];
    }

    // Now we should always have an agent, but just in case:
    if (!activeAgent) {
      return this.getProvider().chat(messages);
    }

    // --- Agent Loop (ReAct) ---
    const { getSystemPromptWithTools, tools } = await import("./agentService");

    // 1. Prepare history with system prompt
    const systemPrompt = getSystemPromptWithTools(activeAgent);
    let history: Message[] = [
      { role: "system", content: systemPrompt },
      ...messages.filter((m) => m.role !== "system"),
    ];

    const provider = this.getProvider();

    // Max turns to prevent infinite loops (Increased to 10)
    for (let i = 0; i < 10; i++) {
      const response = await provider.chat(history);

      // Try parse tool call
      try {
        // Heuristic: Check if response looks like JSON or contains JSON block
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonStr = jsonMatch[0];
          const toolCall = JSON.parse(jsonStr);

          if (toolCall.tool && tools[toolCall.tool]) {
            // Add "Thought" (the raw JSON or surrounding text) to history
            history.push({ role: "assistant", content: response });

            // Execute
            const tool = tools[toolCall.tool];
            const result = await tool.execute(toolCall.args || {});

            // Add "Observation" to history
            history.push({ role: "user", content: `Tool Output: ${result}` });

            // Loop continues to let AI respond to the output
            continue;
          }
        }
      } catch (e) {
        // Not valid JSON or other error, assume final response
        console.warn(
          "Failed to parse agent response as tool call, assuming final text.",
          e,
        );
      }

      // If no tool call, this is the final answer
      return response;
    }

    return "Agent execution limit reached (too many steps).";
  },

  async explainError(log: string): Promise<string> {
    return this.getProvider().explainError(log);
  },

  async getModels(): Promise<string[]> {
    const provider = this.getProvider();
    if (provider.getModels) {
      return provider.getModels();
    }
    return [];
  },
};

export const currentProvider = aiProxy;
