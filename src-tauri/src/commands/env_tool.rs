use crate::services::env_tool_service::{EnvToolCheckResult, EnvToolService, ToolId};
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn check_env_tool(tool: String) -> Result<EnvToolCheckResult, String> {
    let tool_id = ToolId::from_str(&tool).map_err(|e| e.to_string())?;
    EnvToolService::check(tool_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn install_env_tool(tool: String, app: AppHandle) -> Result<(), String> {
    let tool_id = ToolId::from_str(&tool).map_err(|e| e.to_string())?;
    EnvToolService::install(tool_id, app)
        .await
        .map_err(|e| e.to_string())
}
