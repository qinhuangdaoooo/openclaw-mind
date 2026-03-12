use crate::models::agent::{Agent, AgentFiles};
use crate::services::agent_service::AgentService;
use tauri::Emitter;
use tauri::State;

#[tauri::command]
pub async fn list_agents(agent_service: State<'_, AgentService>) -> Result<Vec<Agent>, String> {
    agent_service.list().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_agent(
    name: String,
    workspace: String,
    model: Option<String>,
    agent_service: State<'_, AgentService>,
) -> Result<Agent, String> {
    agent_service
        .create(&name, &workspace, model.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn read_agent_files(
    agent_id: String,
    agent_service: State<'_, AgentService>,
) -> Result<AgentFiles, String> {
    agent_service
        .read_files(&agent_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn write_agent_file(
    agent_id: String,
    filename: String,
    content: String,
    agent_service: State<'_, AgentService>,
) -> Result<(), String> {
    agent_service
        .write_file(&agent_id, &filename, &content)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_agent(
    agent_id: String,
    agent_service: State<'_, AgentService>,
) -> Result<(), String> {
    agent_service
        .delete(&agent_id)
        .await
        .map_err(|e| e.to_string())
}

/// 读取工作区文件（SOUL.md, AGENTS.md, MEMORY.md 等）
#[tauri::command]
pub async fn read_workspace_file(
    workspace: String,
    filename: String,
    agent_service: State<'_, AgentService>,
) -> Result<String, String> {
    agent_service
        .read_workspace_file(&workspace, &filename)
        .await
        .map_err(|e| e.to_string())
}

/// 写入工作区文件
#[tauri::command]
pub async fn write_workspace_file(
    workspace: String,
    filename: String,
    content: String,
    agent_service: State<'_, AgentService>,
) -> Result<(), String> {
    agent_service
        .write_workspace_file(&workspace, &filename, &content)
        .await
        .map_err(|e| e.to_string())
}

/// 使用 AI 生成 Agent 配置
#[tauri::command]
pub async fn generate_agent_config_ai(
    app: tauri::AppHandle,
    description: String,
    api_key: String,
    provider: String,
    base_url: String,
    model: Option<String>,
    ai_service: State<'_, crate::services::ai_service::AiService>,
) -> Result<(), String> {
    let ai_service = ai_service.inner().clone();

    tauri::async_runtime::spawn(async move {
        if let Err(e) = ai_service
            .generate_agent_config(app.clone(), description, api_key, provider, base_url, model)
            .await
        {
            let _ = app.emit("agent-config-error", e.to_string());
        }
    });

    Ok(())
}
