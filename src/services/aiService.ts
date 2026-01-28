import { useAIStore, Message } from "../stores/aiStore";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { notifications } from "@mantine/notifications";

export interface AIProvider {
  id: string;
  name: string;
  chat(messages: Message[]): Promise<string>;
  explainError(log: string): Promise<string>;
  getEmbedding(text: string): Promise<number[]>;
  getModels?(): Promise<string[]>;
}

export const aiProxy = {
  // Deprecated client-side chat, now effectively a wrapper for backend agent
  async chat(
    history: Message[],
    onStream: (chunk: string) => void,
  ): Promise<string> {
    const store = useAIStore.getState();
    const config = {
      provider: store.provider,
      api_key:
        store.provider === "openai"
          ? store.openaiKey
          : store.provider === "gemini"
            ? store.geminiKey
            : undefined,
      model:
        store.provider === "openai"
          ? store.openaiModel
          : store.provider === "gemini"
            ? store.geminiModel
            : store.provider === "ollama"
              ? store.ollamaModel
              : undefined,
      url: store.provider === "ollama" ? store.ollamaUrl : undefined,
    };

    let fullResponse = "";
    const listeners: (() => void)[] = [];
    let cleanupDone = false;

    // Helper to emit stream formatted for UI
    const emitThinking = (thought: string) => {
      console.log("Thought:", thought);
    };

    const teardown = () => {
      console.log("[AIProxy] Teardown called");
      if (cleanupDone) return;
      cleanupDone = true;
      listeners.forEach((unlisten) => unlisten());
    };

    return new Promise(async (resolve, reject) => {
      try {
        console.log("[AIProxy] Setting up listeners...");
        // Setup Listeners
        listeners.push(
          await listen("agent-thought", (event: any) => {
            console.log("[Event] agent-thought:", event.payload);
            emitThinking(event.payload);
          }),
        );
        // ... (existing listeners are fine) ...
        listeners.push(
          await listen("agent-observation", (event: any) => {
            console.log("[Event] agent-observation:", event.payload);
          }),
        );

        listeners.push(
          await listen("agent-response", (event: any) => {
            console.log("[Event] agent-response chunk received");
            fullResponse += event.payload;
            onStream(event.payload);
          }),
        );

        listeners.push(
          await listen("agent-finished", (event: any) => {
            console.log("[Event] agent-finished:", event.payload);
            teardown();
            resolve(fullResponse);
          }),
        );

        listeners.push(
          await listen("agent-error", (event: any) => {
            console.error("[Event] agent-error:", event.payload);
            teardown();
            notifications.show({
              title: "Agent Error",
              message: event.payload,
              color: "red",
            });
            reject(new Error(event.payload));
          }),
        );

        listeners.push(
          await listen("agent-proposal", async (event: any) => {
            // ... existing proposal logic ...
            console.log("[Event] agent-proposal:", event.payload);
            const { path, new_content } = event.payload;

            // 1. Read existing file content
            let old_content = "";
            import("@tauri-apps/plugin-fs").then(async (fs) => {
              try {
                old_content = await fs.readTextFile(path);
              } catch (e) {
                old_content = ""; // New file?
              }

              const { useTabsStore } = await import("../stores/useTabsStore");
              useTabsStore.getState().openTab({
                id: `diff-${path}`, // Unique ID for diff
                title: `Diff: ${path.split("/").pop()}`,
                type: "diff-view",
                diffData: {
                  original: old_content,
                  modified: new_content,
                  originalPath: path,
                },
              });

              notifications.show({
                title: "Review Changes",
                message: "Agent proposed edits. Review in the new Diff tab.",
                color: "blue",
              });
            });
          }),
        );

        // Map frontend messages to backend AgentMessage format
        const chatHistory = history.map((msg) => ({
          role: msg.role,
          content: msg.content,
          tool_calls: null,
          tool_call_id: null,
        }));

        // Start Agent
        console.log(
          "[AIProxy] Invoking start_agent_cmd with history length:",
          chatHistory.length,
        );
        await invoke("start_agent_cmd", {
          chatHistory: chatHistory,
          config: config,
        });
        console.log("[AIProxy] Invoke success");
      } catch (e: any) {
        console.error("[AIProxy] Invoke failed:", e);
        teardown();
        reject(e);
      }
    });
  },

  async getEmbedding(_text: string): Promise<number[]> {
    return [];
  },
};

// Compatibility Shim for legacy components
export const currentProvider = {
  getModels: async (): Promise<string[]> => {
    // Return standard models for now until backend command is ready
    return ["gpt-4o", "gpt-4-turbo", "gemini-1.5-flash", "llama3"];
  },
  chat: async (messages: Message[]): Promise<string> => {
    // Call aiProxy.chat with the FULL history.
    return await aiProxy.chat(messages, (_chunk) => {
      // If we want to support streaming in the legacy UI, we'd need to emit events differently
      // or rely on the fact that aiProxy.chat already emits global events which the Sidebar might listen to?
      // Actually, the new Agent uses global events 'agent-thought', 'agent-response'.
      // So even without this callback, the UI might update if it listens to those events.
    });
  },
};

// Helper to generate a title
export const generateConversationTitle = async (
  messages: Message[],
): Promise<string> => {
  const summaryPrompt: Message = {
    role: "user",
    content:
      "Summarize the above conversation into a concise title (max 5 words). Do not include quotes or extra text. Just the title.",
  };

  try {
    // We reuse the existing chat proxy.
    // Note: This might trigger global 'agent-thought' events which the UI will display.
    // This is acceptable for now.
    const response = await aiProxy.chat([...messages, summaryPrompt], () => {});
    return response.replace(/["']/g, "").trim();
  } catch (e) {
    console.warn("Failed to generate title:", e);
    return "New Chat";
  }
};
