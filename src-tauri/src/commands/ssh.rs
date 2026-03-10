use crate::models::connection::{CommandOutput, SshConfig};
use crate::services::ssh_service::SshService;

#[tauri::command]
pub async fn test_ssh_connection(config: SshConfig) -> Result<bool, String> {
    SshService::test_connection(&config)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn execute_ssh_command(
    config: SshConfig,
    command: String,
) -> Result<CommandOutput, String> {
    SshService::execute_command(&config, &command)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn upload_ssh_file(
    config: SshConfig,
    local_path: String,
    remote_path: String,
) -> Result<(), String> {
    SshService::upload_file(&config, &local_path, &remote_path)
        .await
        .map_err(|e| e.to_string())
}
