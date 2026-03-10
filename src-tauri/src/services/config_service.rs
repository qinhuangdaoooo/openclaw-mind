use crate::models::config::OpenclawConfig;
use crate::error::{AppError, Result};
use std::path::PathBuf;
use tokio::fs;
use serde_json::Value;

#[derive(Debug, serde::Serialize)]
pub struct ValidationError {
    pub field: String,
    pub message: String,
}

#[derive(Debug, serde::Serialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<ValidationError>,
}

pub struct ConfigService {
    config_path: PathBuf,
}

impl ConfigService {
    pub fn new() -> Self {
        let home = dirs::home_dir().expect("无法获取用户目录");
        let config_path = home.join(".openclaw").join("openclaw.json");
        
        Self { config_path }
    }
    
    pub async fn read(&self) -> Result<OpenclawConfig> {
        let content = fs::read_to_string(&self.config_path).await?;

        // 处理可能存在的 UTF-8 BOM，避免 "expected value at line 1 column 1" 错误
        let content = content.trim_start_matches('\u{feff}');

        let config: OpenclawConfig = serde_json::from_str(content)?;
        Ok(config)
    }
    
    pub async fn write(&self, config: &OpenclawConfig) -> Result<()> {
        // 验证配置
        let validation = Self::validate_config(config);
        if !validation.valid {
            let error_messages: Vec<String> = validation.errors
                .iter()
                .map(|e| format!("{}: {}", e.field, e.message))
                .collect();
            return Err(AppError::Other(format!("配置验证失败:\n{}", error_messages.join("\n"))));
        }
        
        // 确保目录存在
        if let Some(parent) = self.config_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        
        let content = serde_json::to_string_pretty(config)?;
        fs::write(&self.config_path, content).await?;
        Ok(())
    }
    
    pub fn validate_json(json_str: &str) -> Result<ValidationResult> {
        let mut errors = Vec::new();
        
        // 1. 检查 JSON 格式
        let value: Value = match serde_json::from_str(json_str) {
            Ok(v) => v,
            Err(e) => {
                errors.push(ValidationError {
                    field: "JSON".to_string(),
                    message: format!("JSON 格式错误: {}", e),
                });
                return Ok(ValidationResult {
                    valid: false,
                    errors,
                });
            }
        };
        
        // 2. 尝试解析为 OpenclawConfig
        let config: OpenclawConfig = match serde_json::from_value(value) {
            Ok(c) => c,
            Err(e) => {
                errors.push(ValidationError {
                    field: "配置结构".to_string(),
                    message: format!("配置结构错误: {}", e),
                });
                return Ok(ValidationResult {
                    valid: false,
                    errors,
                });
            }
        };
        
        // 3. 验证配置内容
        let validation = Self::validate_config(&config);
        Ok(validation)
    }
    
    pub fn validate_config(config: &OpenclawConfig) -> ValidationResult {
        let mut errors = Vec::new();
        
        // 验证 Gateway 配置
        if let Some(gateway) = &config.gateway {
            if gateway.mode.is_empty() {
                errors.push(ValidationError {
                    field: "gateway.mode".to_string(),
                    message: "Gateway 模式不能为空".to_string(),
                });
            }
            
            if gateway.port == 0 {
                errors.push(ValidationError {
                    field: "gateway.port".to_string(),
                    message: "Gateway 端口不能为 0".to_string(),
                });
            }
            
            if gateway.port > 65535 {
                errors.push(ValidationError {
                    field: "gateway.port".to_string(),
                    message: "Gateway 端口必须在 1-65535 之间".to_string(),
                });
            }
        }
        
        // 验证 Models 配置
        if let Some(models) = &config.models {
            for (name, provider) in &models.providers {
                if provider.api.is_empty() {
                    errors.push(ValidationError {
                        field: format!("models.providers.{}.api", name),
                        message: "Provider API 不能为空".to_string(),
                    });
                }
                
                // 验证 URL 格式
                if !provider.api.starts_with("http://") && !provider.api.starts_with("https://") {
                    errors.push(ValidationError {
                        field: format!("models.providers.{}.api", name),
                        message: "API 地址必须以 http:// 或 https:// 开头".to_string(),
                    });
                }
            }
        }
        
        // 验证 Agents 配置
        if let Some(agents) = &config.agents {
            if let Some(list) = &agents.list {
                for (index, agent) in list.iter().enumerate() {
                    if agent.id.is_empty() {
                        errors.push(ValidationError {
                            field: format!("agents.list[{}].id", index),
                            message: "Agent ID 不能为空".to_string(),
                        });
                    }
                }
            }
        }
        
        ValidationResult {
            valid: errors.is_empty(),
            errors,
        }
    }
    
    pub async fn reload_gateway(&self) -> Result<String> {
        let output = tokio::process::Command::new("openclaw")
            .arg("reload")
            .output()
            .await?;
        
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }
}
