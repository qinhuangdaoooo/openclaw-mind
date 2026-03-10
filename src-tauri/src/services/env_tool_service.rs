use crate::error::{AppError, Result};
use serde::{Deserialize, Serialize};
use tokio::process::Command;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ToolId {
    Node,
    Python,
    Docker,
    Git,
    Openclaw,
}

impl ToolId {
    pub fn from_str(s: &str) -> Result<Self> {
        match s.to_lowercase().as_str() {
            "node" => Ok(Self::Node),
            "python" => Ok(Self::Python),
            "docker" => Ok(Self::Docker),
            "git" => Ok(Self::Git),
            "openclaw" => Ok(Self::Openclaw),
            _ => Err(AppError::Other(format!("未知的工具: {}", s))),
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
        let cmd_name = tool.command_name();
        
        // 检查命令是否存在
        let which_output = Command::new("where")
            .arg(cmd_name)
            .output()
            .await;
        
        let found = which_output
            .map(|o| o.status.success())
            .unwrap_or(false);
        
        if !found {
            return Ok(EnvToolCheckResult {
                found: false,
                version: None,
            });
        }
        
        // 尝试获取版本
        let version = Self::get_version(&tool).await.ok();
        
        Ok(EnvToolCheckResult { found, version })
    }
    
    async fn get_version(tool: &ToolId) -> Result<String> {
        let cmd_name = tool.command_name();
        let version_arg = match tool {
            ToolId::Node | ToolId::Python | ToolId::Docker | ToolId::Git => "--version",
            ToolId::Openclaw => "--version",
        };
        
        let output = Command::new(cmd_name)
            .arg(version_arg)
            .output()
            .await
            .map_err(|e| AppError::Other(format!("获取版本失败: {}", e)))?;
        
        let version = String::from_utf8_lossy(&output.stdout)
            .lines()
            .next()
            .unwrap_or("")
            .to_string();
        
        Ok(version)
    }
    
    pub async fn install(tool: ToolId, app: AppHandle) -> Result<()> {
        Self::emit_log(&app, &format!("开始安装 {}...", tool.command_name()));
        Self::emit_progress(&app, 0);
        
        match tool {
            ToolId::Node => Self::install_node(app).await,
            ToolId::Python => Self::install_python(app).await,
            ToolId::Docker => Self::install_docker(app).await,
            ToolId::Git => Self::install_git(app).await,
            ToolId::Openclaw => Self::install_openclaw(app).await,
        }
    }
    
    fn emit_log(app: &AppHandle, message: &str) {
        let _ = app.emit("install-log", message.to_string());
    }
    
    fn emit_progress(app: &AppHandle, progress: u8) {
        let _ = app.emit("install-progress", progress);
    }
    
    async fn install_node(app: AppHandle) -> Result<()> {
        Self::emit_log(&app, "检测 winget 是否可用...");
        Self::emit_progress(&app, 10);
        
        // 尝试使用 winget 安装
        let winget_check = Command::new("winget")
            .arg("--version")
            .output()
            .await;
        
        if winget_check.is_ok() {
            Self::emit_log(&app, "使用 winget 安装 Node.js...");
            Self::emit_progress(&app, 30);
            
            let output = Command::new("winget")
                .args(&["install", "OpenJS.NodeJS", "--accept-package-agreements", "--accept-source-agreements"])
                .output()
                .await
                .map_err(|e| AppError::Other(format!("安装失败: {}", e)))?;
            
            Self::emit_progress(&app, 80);
            
            if output.status.success() {
                Self::emit_log(&app, "Node.js 安装成功！");
                Self::emit_progress(&app, 100);
                Ok(())
            } else {
                let error = String::from_utf8_lossy(&output.stderr);
                Self::emit_log(&app, &format!("安装失败: {}", error));
                Err(AppError::Other(format!("安装失败: {}", error)))
            }
        } else {
            Self::emit_log(&app, "winget 不可用，请手动安装 Node.js");
            Self::emit_log(&app, "下载地址: https://nodejs.org/");
            Err(AppError::Other("winget 不可用，请手动安装".to_string()))
        }
    }
    
    async fn install_python(app: AppHandle) -> Result<()> {
        Self::emit_log(&app, "检测 winget 是否可用...");
        Self::emit_progress(&app, 10);
        
        let winget_check = Command::new("winget")
            .arg("--version")
            .output()
            .await;
        
        if winget_check.is_ok() {
            Self::emit_log(&app, "使用 winget 安装 Python...");
            Self::emit_progress(&app, 30);
            
            let output = Command::new("winget")
                .args(&["install", "Python.Python.3.12", "--accept-package-agreements", "--accept-source-agreements"])
                .output()
                .await
                .map_err(|e| AppError::Other(format!("安装失败: {}", e)))?;
            
            Self::emit_progress(&app, 80);
            
            if output.status.success() {
                Self::emit_log(&app, "Python 安装成功！");
                Self::emit_progress(&app, 100);
                Ok(())
            } else {
                let error = String::from_utf8_lossy(&output.stderr);
                Self::emit_log(&app, &format!("安装失败: {}", error));
                Err(AppError::Other(format!("安装失败: {}", error)))
            }
        } else {
            Self::emit_log(&app, "winget 不可用，请手动安装 Python");
            Self::emit_log(&app, "下载地址: https://www.python.org/downloads/");
            Err(AppError::Other("winget 不可用，请手动安装".to_string()))
        }
    }
    
    async fn install_docker(app: AppHandle) -> Result<()> {
        Self::emit_log(&app, "Docker Desktop 需要手动安装");
        Self::emit_log(&app, "下载地址: https://www.docker.com/products/docker-desktop/");
        Self::emit_log(&app, "请下载并运行安装程序");
        Self::emit_progress(&app, 100);
        Err(AppError::Other("Docker 需要手动安装".to_string()))
    }
    
    async fn install_git(app: AppHandle) -> Result<()> {
        Self::emit_log(&app, "检测 winget 是否可用...");
        Self::emit_progress(&app, 10);
        
        let winget_check = Command::new("winget")
            .arg("--version")
            .output()
            .await;
        
        if winget_check.is_ok() {
            Self::emit_log(&app, "使用 winget 安装 Git...");
            Self::emit_progress(&app, 30);
            
            let output = Command::new("winget")
                .args(&["install", "Git.Git", "--accept-package-agreements", "--accept-source-agreements"])
                .output()
                .await
                .map_err(|e| AppError::Other(format!("安装失败: {}", e)))?;
            
            Self::emit_progress(&app, 80);
            
            if output.status.success() {
                Self::emit_log(&app, "Git 安装成功！");
                Self::emit_progress(&app, 100);
                Ok(())
            } else {
                let error = String::from_utf8_lossy(&output.stderr);
                Self::emit_log(&app, &format!("安装失败: {}", error));
                Err(AppError::Other(format!("安装失败: {}", error)))
            }
        } else {
            Self::emit_log(&app, "winget 不可用，请手动安装 Git");
            Self::emit_log(&app, "下载地址: https://git-scm.com/downloads");
            Err(AppError::Other("winget 不可用，请手动安装".to_string()))
        }
    }
    
    async fn install_openclaw(app: AppHandle) -> Result<()> {
        Self::emit_log(&app, "检测 npm 是否可用...");
        Self::emit_progress(&app, 10);
        
        let npm_check = Command::new("npm")
            .arg("--version")
            .output()
            .await;
        
        if npm_check.is_ok() {
            Self::emit_log(&app, "使用 npm 安装 OpenClaw CLI...");
            Self::emit_progress(&app, 30);
            
            let output = Command::new("npm")
                .args(&["install", "-g", "@openclaw/cli"])
                .output()
                .await
                .map_err(|e| AppError::Other(format!("安装失败: {}", e)))?;
            
            Self::emit_progress(&app, 80);
            
            if output.status.success() {
                Self::emit_log(&app, "OpenClaw CLI 安装成功！");
                Self::emit_progress(&app, 100);
                Ok(())
            } else {
                let error = String::from_utf8_lossy(&output.stderr);
                Self::emit_log(&app, &format!("安装失败: {}", error));
                Err(AppError::Other(format!("安装失败: {}", error)))
            }
        } else {
            Self::emit_log(&app, "npm 不可用，请先安装 Node.js");
            Err(AppError::Other("npm 不可用，请先安装 Node.js".to_string()))
        }
    }
}
