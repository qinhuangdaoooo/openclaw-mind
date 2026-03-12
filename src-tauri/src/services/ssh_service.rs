use crate::error::{AppError, Result};
use crate::models::connection::{CommandOutput, SshConfig};
use tokio::process::Command;

pub struct SshService;

impl SshService {
    pub async fn execute_command(config: &SshConfig, command: &str) -> Result<CommandOutput> {
        let ssh_cmd = format!(
            "ssh -p {} {}@{} '{}'",
            config.port,
            config.username,
            config.host,
            command.replace("'", "'\\''")
        );

        let output = Command::new("sh")
            .arg("-c")
            .arg(&ssh_cmd)
            .output()
            .await
            .map_err(|e| AppError::Ssh(format!("执行 SSH 命令失败: {}", e)))?;

        Ok(CommandOutput::new(
            String::from_utf8_lossy(&output.stdout).to_string(),
            String::from_utf8_lossy(&output.stderr).to_string(),
            output.status.code().unwrap_or(-1),
        ))
    }

    pub async fn test_connection(config: &SshConfig) -> Result<bool> {
        let result = Self::execute_command(config, "echo 'OK'").await?;
        Ok(result.success && result.stdout.trim() == "OK")
    }

    pub async fn upload_file(
        config: &SshConfig,
        local_path: &str,
        remote_path: &str,
    ) -> Result<()> {
        let scp_cmd = format!(
            "scp -P {} {} {}@{}:{}",
            config.port, local_path, config.username, config.host, remote_path
        );

        let output = Command::new("sh")
            .arg("-c")
            .arg(&scp_cmd)
            .output()
            .await
            .map_err(|e| AppError::Ssh(format!("上传文件失败: {}", e)))?;

        if !output.status.success() {
            return Err(AppError::Ssh(format!(
                "上传文件失败: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        Ok(())
    }
}
