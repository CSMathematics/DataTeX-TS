use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::Mutex;

use crate::ai::{self, ProviderConfig};
use crate::database::DatabaseManager;
use crate::tools::ToolRegistry;
use crate::vectors::VectorStoreState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessage {
    pub role: String, // "user" | "assistant" | "system" | "tool"
    pub content: Option<String>,
    pub tool_calls: Option<Vec<ToolCall>>,
    pub tool_call_id: Option<String>, // For role="tool"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub function: ToolCallFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallFunction {
    pub name: String,
    pub arguments: String, // JSON string
}

pub struct AgentState {
    pub messages: Vec<AgentMessage>,
    pub tools: Arc<ToolRegistry>,
    pub config: ProviderConfig,
    pub is_running: bool,
}

impl AgentState {
    pub fn new(
        config: ProviderConfig,
        db_manager: Arc<Mutex<Option<DatabaseManager>>>,
        vector_store: Arc<VectorStoreState>,
        app_handle: tauri::AppHandle,
    ) -> Self {
        AgentState {
            messages: Vec::new(),
            tools: Arc::new(ToolRegistry::new(
                app_handle,
                db_manager,
                vector_store,
                config.clone(),
            )),
            config,
            is_running: false,
        }
    }

    pub fn add_message(&mut self, msg: AgentMessage) {
        self.messages.push(msg);
    }
}

// Global Agent Wrapper
pub struct GlobalAgent(pub Arc<Mutex<Option<AgentState>>>);

// --- Commands ---

#[tauri::command]
pub async fn start_agent_cmd(
    chat_history: Vec<AgentMessage>,
    config: ProviderConfig,
    state: tauri::State<'_, GlobalAgent>,
    app_handle: tauri::AppHandle,
    // Extract State
    app_state: tauri::State<'_, crate::AppState>,
    vector_state: tauri::State<'_, VectorStoreState>,
) -> Result<(), String> {
    println!(
        "[AGENT] Starting agent command. History length: {}",
        chat_history.len()
    );
    println!(
        "[AGENT] Provider: {}, model: {}",
        config.provider,
        config.model.as_deref().unwrap_or("default")
    );

    // 1. Initialize State
    let mut agent_guard = state.0.lock().await;

    // Inject dependencies
    let db_manager = app_state.db_manager.clone();
    // Clone the VectorStoreState struct (wrapper around Arc)
    let vector_store_state_inner = vector_state.0.clone(); // This is Arc<Mutex<VectorStore>>
    let vector_store_arc = Arc::new(VectorStoreState(vector_store_state_inner)); // Re-wrap in VectorStoreState struct

    // Create new agent with dependencies
    let mut agent = AgentState::new(config, db_manager, vector_store_arc, app_handle.clone());
    agent.is_running = true;

    // System Prompt (could be passed in, simpler for now)
    agent.add_message(AgentMessage {
        role: "system".to_string(),
        content: Some("You are a helpful AI assistant integrated into a LaTeX editor.
You are connected to a Database of User Resources (files).
CRITICAL RULES:
1. You MUST use `find_resource(name, optional_collection)` to locate user files. If the user specifies a base/collection, pass it as the second argument.
2. You MUST use `search_files(query)` to find files containing specific text.
3. When suggesting any file modification, you MUST use `propose_edit` so the user can review it before it is applied.
4. Never claim that a file or command was changed or executed unless a tool result explicitly confirms it.".to_string()),
        tool_calls: None,
        tool_call_id: None,
    });

    // Add User History
    // Note: The history likely contains User/Assistant turns.
    // Ideally, we should filter out Tool calls if they were not persisted properly, but frontend only tracks User/Assistant for now.
    // If we want to support persistent Tool outputs, we need frontend to store them.
    // For now, assume history is just text conversation.
    for msg in chat_history {
        agent.add_message(msg);
    }

    *agent_guard = Some(agent);
    drop(agent_guard); // Release lock while thinking

    // 2. Start Background Loop (Spawn Task)
    let state_clone = state.0.clone();

    // We shouldn't spawn a new loop if one is already running?
    // Implementation Detail: This start_agent_cmd assumes we kick off a processing run.
    // If we want a persistent loop, we should check if running.
    // But for now, we just spawn the processing logic which processes until done.

    let app_handle_clone = app_handle.clone(); // Capture app_handle for emitting events

    tauri::async_runtime::spawn(async move {
        let state_arc = state_clone;
        let app_handle = app_handle_clone; // Use the captured app_handle

        let max_steps = 10;
        let mut current_step = 0;

        loop {
            // 1. Check if running and Loop Limit
            {
                let guard = state_arc.lock().await;
                if let Some(agent) = &*guard {
                    if !agent.is_running || current_step >= max_steps {
                        let _ = app_handle.emit("agent-finished", "Top limit reached or stopped");
                        break;
                    }
                } else {
                    break; // No agent?
                }
            }
            current_step += 1;

            // A. Get Next Step
            let (messages, tools_registry, config) = {
                let guard = state_arc.lock().await;
                if let Some(agent) = guard.as_ref() {
                    (
                        agent.messages.clone(),
                        agent.tools.clone(), // Clone the Arc<ToolRegistry>
                        agent.config.clone(),
                    )
                } else {
                    break;
                }
            };

            // Emit "Thought" Event
            let _ = app_handle.emit("agent-thought", "Thinking...");

            // B. Call AI
            let tool_defs = tools_registry.get_definitions();
            let response_result = ai::chat(&messages, &tool_defs, &config)
                .await
                .map_err(|e| e.to_string());

            // C. Handle Response
            match response_result {
                Ok(response_msg) => {
                    // Add assistant message to state
                    {
                        let mut guard = state_arc.lock().await;
                        if let Some(agent) = guard.as_mut() {
                            agent.add_message(response_msg.clone());
                            // Emit thought/response
                            // Note: We need app_handle to emit events?
                            // We don't have app_handle in this closure.
                            // We should pass it or use global event emitter if possible.
                            // Actually we can't emit without app_handle.
                            // We skipped passing app_handle to spawn.
                        }
                    }

                    // Check for tool calls
                    if let Some(calls) = &response_msg.tool_calls {
                        if !calls.is_empty() {
                            let _ = app_handle.emit(
                                "agent-thought",
                                format!(
                                    "Calling tools: {}",
                                    calls
                                        .iter()
                                        .map(|tc| format!(
                                            "{}({})",
                                            tc.function.name, tc.function.arguments
                                        ))
                                        .collect::<Vec<_>>()
                                        .join(", ")
                                ),
                            );

                            // Execute Tools
                            for tool_call in calls {
                                let tool_name = &tool_call.function.name;
                                let args_str = &tool_call.function.arguments;
                                let call_id = &tool_call.id;

                                let output = {
                                    let args_res: Result<Value, _> = serde_json::from_str(args_str);
                                    match args_res {
                                        Ok(args) => {
                                            // Get Tool from the cloned registry
                                            if let Some(tool) = tools_registry.get(tool_name) {
                                                match tool.execute(args).await {
                                                    Ok(out) => out,
                                                    Err(e) => format!("Error: {}", e),
                                                }
                                            } else {
                                                format!("Error: Tool '{}' not found", tool_name)
                                            }
                                        }
                                        Err(e) => format!(
                                            "Error parsing arguments for tool '{}': {}",
                                            tool_name, e
                                        ),
                                    }
                                };

                                // Add Tool Output Message
                                {
                                    let mut guard = state_arc.lock().await;
                                    if let Some(agent) = guard.as_mut() {
                                        agent.add_message(AgentMessage {
                                            role: "tool".to_string(),
                                            content: Some(output.clone()),
                                            tool_calls: None,
                                            tool_call_id: Some(call_id.clone()),
                                        });
                                    }
                                }

                                // Emit observation event
                                let _ = app_handle.emit("agent-observation", output);
                            }
                            // Loop continues to next turn to feed tool outputs back to AI
                            continue;
                        } else {
                            // No tools, just text. Done?
                            if let Some(content) = response_msg.content {
                                let _ = app_handle.emit("agent-response", content);
                            }
                            let _ = app_handle.emit("agent-finished", "Done");
                            break;
                        }
                    } else {
                        // No tool calls. Done.
                        if let Some(content) = response_msg.content {
                            let _ = app_handle.emit("agent-response", content);
                        }
                        let _ = app_handle.emit("agent-finished", "Done");
                        break;
                    }
                }
                Err(e) => {
                    println!("[AGENT] Error: {}", e);
                    let _ = app_handle.emit("agent-error", e.to_string());
                    break;
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_agent_cmd(state: tauri::State<'_, GlobalAgent>) -> Result<(), String> {
    let mut agent_opt = state.0.lock().await;
    if let Some(agent) = agent_opt.as_mut() {
        agent.is_running = false;
    }
    Ok(())
}

// The original `run_agent_loop` is replaced by the logic inside the `spawn` block in `start_agent_cmd`.
// If `run_agent_loop` is still needed elsewhere, it would need to be updated similarly.
// For now, I'm assuming the user's provided code snippet for the `spawn` block is the new `run_agent_loop` logic.
// The original `run_agent_loop` function is now commented out or removed based on the instruction.
// Since the instruction provided a full replacement for the `spawn` block, I'm removing the old `run_agent_loop` function.
/*
async fn run_agent_loop(state_arc: Arc<Mutex<Option<AgentState>>>, app_handle: tauri::AppHandle) {
    let max_steps = 10;
    let mut current_step = 0;

    loop {
        // 1. Check if running and Loop Limit
        {
            let guard = state_arc.lock().unwrap();
            if let Some(agent) = &*guard {
                if !agent.is_running || current_step >= max_steps {
                    let _ = app_handle.emit("agent-finished", "Top limit reached or stopped");
                    break;
                }
            } else {
                break; // No agent?
            }
        }
        current_step += 1;

        // 2. Prepare Context for AI
        // We need to clone messages to pass to async AI
        // (Optimally we could stream, but cloning for now is safer around Mutex)
        let (messages, config, tool_defs) = {
            let guard = state_arc.lock().unwrap();
            let agent = guard.as_ref().unwrap();
            (
                agent.messages.clone(),
                agent.config.clone(),
                agent.tools.get_definitions(),
            )
        };

        // Emit "Thought" Event
        let _ = app_handle.emit("agent-thought", "Thinking...");

        // 3. Call AI
        // We need a chat function in ai.rs. For now, we will mock it or implement a simple one.
        // Assuming ai::chat exists (we should add it to ai.rs if not).
        // For this step to compile, I'll need to define `ai::chat` in the next step.
        // I will assume `ai::chat` takes messages and tool defs and returns an AgentMessage.

        // Since `ai::chat` is not yet implemented, I'll need to update ai.rs first or hack it here.
        // Let's implement the loop logic assuming `ai::chat` works.

        // Placeholder for AI Call
        let response_result = ai::chat(&messages, &tool_defs, &config).await;

        match response_result {
            Ok(response_msg) => {
                // Determine if tool call or final answer
                if let Some(tool_calls) = &response_msg.tool_calls {
                    if tool_calls.is_empty() {
                        // Weird edge case, treat as answer
                        let content = response_msg.content.clone().unwrap_or_default();
                        let _ = app_handle.emit("agent-response", content);
                    } else {
                        // Tool Calls found!
                        let _ = app_handle.emit(
                            "agent-thought",
                            format!(
                                "Calling tools: {:?}",
                                tool_calls
                                    .iter()
                                    .map(|tc| &tc.function.name)
                                    .collect::<Vec<_>>()
                            ),
                        );

                        // Append Assistant Message with Tool Calls
                        {
                            let mut guard = state_arc.lock().unwrap();
                            if let Some(agent) = guard.as_mut() {
                                agent.add_message(response_msg.clone());
                            }
                        }

                        // Execute Tools
                        for tool_call in tool_calls {
                            let tool_name = &tool_call.function.name;
                            let args_str = &tool_call.function.arguments;
                            let call_id = &tool_call.id;

                            // Parse Args
                            let args_res: Result<Value, _> = serde_json::from_str(args_str);
                            let output = match args_res {
                                Ok(args) => {
                                    // Get Tool
                                    let guard = state_arc.lock().unwrap();
                                    if let Some(agent) = guard.as_ref() {
                                        if let Some(tool) = agent.tools.get(tool_name) {
                                            match tool.execute(args) {
                                                Ok(out) => out,
                                                Err(e) => format!("Error: {}", e),
                                            }
                                        } else {
                                            format!("Error: Tool not found")
                                        }
                                    } else {
                                        "Error: Agent state lost".to_string()
                                    }
                                }
                                Err(e) => format!("Error parsing arguments: {}", e),
                            };

                            // Add Tool Output Message
                            {
                                let mut guard = state_arc.lock().unwrap();
                                if let Some(agent) = guard.as_mut() {
                                    agent.add_message(AgentMessage {
                                        role: "tool".to_string(),
                                        content: Some(output.clone()),
                                        tool_calls: None,
                                        tool_call_id: Some(call_id.clone()),
                                    });
                                }
                            }

                            // Emit observation event
                            let _ = app_handle.emit("agent-observation", output);
                        }
                        // Loop continues to next turn to feed tool outputs back to AI
                        continue;
                    }
                }

                // If content exists and no tools (or tools finished), it's an answer (or partial thought)
                if let Some(content) = response_msg.content {
                    let _ = app_handle.emit("agent-response", content);
                }

                // If no tool calls, we consider the turn finished?
                // In generic agents, it might continue, but let's break if no tools.
                if response_msg.tool_calls.is_none() {
                    let _ = app_handle.emit("agent-finished", "Done");
                    break;
                }
            }
            Err(e) => {
                let _ = app_handle.emit("agent-error", e.to_string());
                break;
            }
        }
    }
}
*/
