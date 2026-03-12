use crate::error::{AppError, Result};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ToolId {
    Node,
    Python,
    Docker,
    Git,
    Openclaw,
}

impl ToolId {
    pub fn from_str(value: &str) -> Result<Self> {
        match value.to_lowercase().as_str() {
            "node" => Ok(Self::Node),
            "python" => Ok(Self::Python),
            "docker" => Ok(Self::Docker),
            "git" => Ok(Self::Git),
            "openclaw" => Ok(Self::Openclaw),
            _ => Err(AppError::Other(format!("Unknown tool: {}", value))),
        }
    }

    pub fn command_name(&self) -> &str {
        match self {
            Self::Node => "node",
            Self::Python => "python",
            Self::Docker => "docker",
            Self::Git => "git",
            Self::Openclaw => "openclaw",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvToolCheckResult {
    pub found: bool,
    pub version: Option<String>,
}

pub struct EnvToolService;

impl EnvToolService {
    pub async fn check(tool: ToolId) -> Result<EnvToolCheckResult> {
        let output = Command::new("where")
            .arg(tool.command_name())
            .output()
            .await;

        let found = output.map(|value| value.status.success()).unwrap_or(false);

        if !found {
            return Ok(EnvToolCheckResult {
                found: false,
                version: None,
            });
        }

        let version = Self::get_version(&tool).await.ok();

        Ok(EnvToolCheckResult { found, version })
    }

    async fn get_version(tool: &ToolId) -> Result<String> {
        let output = Command::new(tool.command_name())
            .arg("--version")
            .output()
            .await
            .map_err(|error| AppError::Other(format!("Failed to read version: {}", error)))?;

        let stdout = String::from_utf8_lossy(&output.stdout)
            .lines()
            .next()
            .unwrap_or("")
            .trim()
            .to_string();

        let stderr = String::from_utf8_lossy(&output.stderr)
            .lines()
            .next()
            .unwrap_or("")
            .trim()
            .to_string();

        let version = if stdout.is_empty() { stderr } else { stdout };
        Ok(version)
    }

    pub async fn install(tool: ToolId, app: AppHandle) -> Result<()> {
        Self::emit_log(
            &app,
            &format!("Starting install for {}...", tool.command_name()),
        );
        Self::emit_progress(&app, 0);

        match tool {
            ToolId::Node => Self::install_with_winget(app, "OpenJS.NodeJS", "Node.js").await,
            ToolId::Python => Self::install_with_winget(app, "Python.Python.3.12", "Python").await,
            ToolId::Docker => Self::install_docker(app).await,
            ToolId::Git => Self::install_with_winget(app, "Git.Git", "Git").await,
            ToolId::Openclaw => Self::install_openclaw(app).await,
        }
    }

    pub async fn uninstall(tool: ToolId, app: AppHandle) -> Result<()> {
        Self::emit_log(
            &app,
            &format!("Starting uninstall for {}...", tool.command_name()),
        );
        Self::emit_progress(&app, 0);

        match tool {
            ToolId::Node => Self::uninstall_with_winget(app, "OpenJS.NodeJS", "Node.js").await,
            ToolId::Python => {
                Self::uninstall_with_winget(app, "Python.Python.3.12", "Python").await
            }
            ToolId::Docker => {
                Self::uninstall_with_winget(app, "Docker.DockerDesktop", "Docker Desktop").await
            }
            ToolId::Git => Self::uninstall_with_winget(app, "Git.Git", "Git").await,
            ToolId::Openclaw => Self::uninstall_openclaw(app).await,
        }
    }

    fn emit_log(app: &AppHandle, message: &str) {
        let _ = app.emit("install-log", message.to_string());
    }

    fn emit_progress(app: &AppHandle, progress: u8) {
        let _ = app.emit("install-progress", progress);
    }

    async fn install_with_winget(
        app: AppHandle,
        package_id: &str,
        display_name: &str,
    ) -> Result<()> {
        Self::emit_log(&app, "Checking if winget is available...");
        Self::emit_progress(&app, 10);

        let winget_check = Command::new("winget").arg("--version").output().await;
        if winget_check.is_err() {
            Self::emit_log(&app, "winget is not available; please install manually.");
            return Err(AppError::Other(format!(
                "winget is not available; please install {} manually",
                display_name
            )));
        }

        Self::emit_log(
            &app,
            &format!("Using winget to install {}...", display_name),
        );
        Self::emit_progress(&app, 30);

        let output = Command::new("winget")
            .args([
                "install",
                package_id,
                "--accept-package-agreements",
                "--accept-source-agreements",
            ])
            .output()
            .await
            .map_err(|error| AppError::Other(format!("Install failed: {}", error)))?;

        Self::emit_progress(&app, 80);

        if output.status.success() {
            Self::emit_log(&app, &format!("{} installed successfully.", display_name));
            Self::emit_progress(&app, 100);
            Ok(())
        } else {
            let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
            Self::emit_log(&app, &format!("Install failed: {}", error));
            Err(AppError::Other(format!("Install failed: {}", error)))
        }
    }

    async fn install_docker(app: AppHandle) -> Result<()> {
        Self::emit_log(&app, "Docker Desktop requires manual installation.");
        Self::emit_log(
            &app,
            "Download it from https://www.docker.com/products/docker-desktop/",
        );
        Self::emit_progress(&app, 100);
        Err(AppError::Other(
            "Docker Desktop requires manual installation".to_string(),
        ))
    }

    async fn install_openclaw(app: AppHandle) -> Result<()> {
        Self::emit_log(&app, "Checking if npm is available...");
        Self::emit_progress(&app, 10);

        let npm_check = Command::new("npm").arg("--version").output().await;
        if npm_check.is_err() {
            Self::emit_log(&app, "npm is not available; install Node.js first.");
            return Err(AppError::Other(
                "npm is not available; install Node.js first".to_string(),
            ));
        }

        Self::emit_log(&app, "Using npm to install OpenClaw CLI...");
        Self::emit_progress(&app, 30);

        let output = Command::new("npm")
            .args(["install", "-g", "@openclaw/cli"])
            .output()
            .await
            .map_err(|error| AppError::Other(format!("Install failed: {}", error)))?;

        Self::emit_progress(&app, 80);

        if output.status.success() {
            Self::emit_log(&app, "OpenClaw CLI installed successfully.");
            Self::emit_progress(&app, 100);
            Ok(())
        } else {
            let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
            Self::emit_log(&app, &format!("Install failed: {}", error));
            Err(AppError::Other(format!("Install failed: {}", error)))
        }
    }

    async fn uninstall_with_winget(
        app: AppHandle,
        package_id: &str,
        display_name: &str,
    ) -> Result<()> {
        Self::emit_log(&app, "Checking if winget is available...");
        Self::emit_progress(&app, 10);

        let winget_check = Command::new("winget").arg("--version").output().await;
        if winget_check.is_err() {
            Self::emit_log(&app, "winget is not available; please uninstall manually.");
            return Err(AppError::Other(format!(
                "winget is not available; please uninstall {} manually",
                display_name
            )));
        }

        Self::emit_log(
            &app,
            &format!("Using winget to uninstall {}...", display_name),
        );
        Self::emit_progress(&app, 30);

        let output = Command::new("winget")
            .args([
                "uninstall",
                package_id,
                "--accept-source-agreements",
                "--disable-interactivity",
            ])
            .output()
            .await
            .map_err(|error| AppError::Other(format!("Uninstall failed: {}", error)))?;

        Self::emit_progress(&app, 80);

        if output.status.success() {
            Self::emit_log(&app, &format!("{} uninstalled successfully.", display_name));
            Self::emit_progress(&app, 100);
            Ok(())
        } else {
            let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
            Self::emit_log(&app, &format!("Uninstall failed: {}", error));
            Err(AppError::Other(format!("Uninstall failed: {}", error)))
        }
    }

    async fn uninstall_openclaw(app: AppHandle) -> Result<()> {
        Self::emit_log(&app, "Checking if npm is available...");
        Self::emit_progress(&app, 10);

        let npm_check = Command::new("npm").arg("--version").output().await;
        if npm_check.is_err() {
            Self::emit_log(&app, "npm is not available; remove OpenClaw CLI manually.");
            return Err(AppError::Other("npm is not available".to_string()));
        }

        Self::emit_log(&app, "Using npm to uninstall OpenClaw CLI...");
        Self::emit_progress(&app, 30);

        let output = Command::new("npm")
            .args(["uninstall", "-g", "@openclaw/cli"])
            .output()
            .await
            .map_err(|error| AppError::Other(format!("Uninstall failed: {}", error)))?;

        Self::emit_progress(&app, 80);

        if output.status.success() {
            Self::emit_log(&app, "OpenClaw CLI uninstalled successfully.");
            Self::emit_progress(&app, 100);
            Ok(())
        } else {
            let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
            Self::emit_log(&app, &format!("Uninstall failed: {}", error));
            Err(AppError::Other(format!("Uninstall failed: {}", error)))
        }
    }
}
