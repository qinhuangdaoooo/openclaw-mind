use crate::error::{AppError, Result};
use crate::models::config::OpenclawConfig;
use serde_json::Value;
use std::path::PathBuf;
use tokio::fs;

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

#[derive(Debug, Clone, serde::Serialize)]
pub struct ChannelTestResult {
    pub success: bool,
    pub message: String,
    pub details: Option<String>,
}

pub struct ConfigService {
    config_path: PathBuf,
}

impl ConfigService {
    pub fn new() -> Self {
        let home = dirs::home_dir().expect("Failed to locate home directory");
        let config_path = home.join(".openclaw").join("openclaw.json");
        Self { config_path }
    }

    pub async fn read(&self) -> Result<OpenclawConfig> {
        let content = fs::read_to_string(&self.config_path).await?;
        let content = content.trim_start_matches('\u{feff}');
        let config: OpenclawConfig = serde_json::from_str(content)?;
        Ok(config)
    }

    pub async fn write(&self, config: &OpenclawConfig) -> Result<()> {
        let validation = Self::validate_config(config);
        if !validation.valid {
            let error_messages: Vec<String> = validation
                .errors
                .iter()
                .map(|error| format!("{}: {}", error.field, error.message))
                .collect();
            return Err(AppError::Other(format!(
                "Config validation failed:\n{}",
                error_messages.join("\n")
            )));
        }

        if let Some(parent) = self.config_path.parent() {
            fs::create_dir_all(parent).await?;
        }

        let content = serde_json::to_string_pretty(config)?;
        fs::write(&self.config_path, content).await?;
        Ok(())
    }

    pub fn validate_json(json_str: &str) -> Result<ValidationResult> {
        let mut errors = Vec::new();

        let value: Value = match serde_json::from_str(json_str) {
            Ok(value) => value,
            Err(error) => {
                errors.push(ValidationError {
                    field: "JSON".to_string(),
                    message: format!("Invalid JSON: {}", error),
                });
                return Ok(ValidationResult {
                    valid: false,
                    errors,
                });
            }
        };

        let config: OpenclawConfig = match serde_json::from_value(value) {
            Ok(config) => config,
            Err(error) => {
                errors.push(ValidationError {
                    field: "config".to_string(),
                    message: format!("Invalid config structure: {}", error),
                });
                return Ok(ValidationResult {
                    valid: false,
                    errors,
                });
            }
        };

        Ok(Self::validate_config(&config))
    }

    pub fn validate_config(config: &OpenclawConfig) -> ValidationResult {
        let mut errors = Vec::new();

        if let Some(gateway) = &config.gateway {
            if gateway.mode.trim().is_empty() {
                errors.push(ValidationError {
                    field: "gateway.mode".to_string(),
                    message: "Gateway mode cannot be empty".to_string(),
                });
            }

            if gateway.port == 0 {
                errors.push(ValidationError {
                    field: "gateway.port".to_string(),
                    message: "Gateway port must be between 1 and 65535".to_string(),
                });
            }
        }

        if let Some(models) = &config.models {
            for (name, provider) in &models.providers {
                if provider.api.trim().is_empty() {
                    errors.push(ValidationError {
                        field: format!("models.providers.{}.api", name),
                        message: "Provider API cannot be empty".to_string(),
                    });
                }

                let base_url = provider.base_url.as_deref().unwrap_or("").trim();
                let api = provider.api.trim();
                let endpoint = if !base_url.is_empty() {
                    Some(base_url)
                } else if api.starts_with("http://") || api.starts_with("https://") {
                    Some(api)
                } else {
                    None
                };

                if let Some(endpoint) = endpoint {
                    if !endpoint.starts_with("http://") && !endpoint.starts_with("https://") {
                        errors.push(ValidationError {
                            field: format!("models.providers.{}.baseUrl", name),
                            message: "Provider baseUrl must start with http:// or https://"
                                .to_string(),
                        });
                    }
                }

                if let Some(models) = &provider.models {
                    if models.is_empty() {
                        errors.push(ValidationError {
                            field: format!("models.providers.{}.models", name),
                            message: "Provider model list cannot be empty".to_string(),
                        });
                    }
                } else {
                    errors.push(ValidationError {
                        field: format!("models.providers.{}.models", name),
                        message: "Provider model list cannot be empty".to_string(),
                    });
                }
            }
        }

        if let Some(agents) = &config.agents {
            if let Some(list) = &agents.list {
                for (index, agent) in list.iter().enumerate() {
                    if agent.id.trim().is_empty() {
                        errors.push(ValidationError {
                            field: format!("agents.list[{}].id", index),
                            message: "Agent ID cannot be empty".to_string(),
                        });
                    }
                }
            }
        }

        if let Some(bindings) = &config.bindings {
            for (index, binding) in bindings.iter().enumerate() {
                if binding.agent_id.trim().is_empty() {
                    errors.push(ValidationError {
                        field: format!("bindings[{}].agentId", index),
                        message: "Binding agentId cannot be empty".to_string(),
                    });
                }

                if binding.matcher.channel.trim().is_empty() {
                    errors.push(ValidationError {
                        field: format!("bindings[{}].match.channel", index),
                        message: "Binding channel cannot be empty".to_string(),
                    });
                }
            }
        }

        if let Some(channels) = &config.channels {
            if let Some(feishu) = &channels.feishu {
                if feishu.enabled.unwrap_or(false) {
                    if feishu.app_id.as_deref().unwrap_or("").trim().is_empty() {
                        errors.push(ValidationError {
                            field: "channels.feishu.appId".to_string(),
                            message: "Feishu appId is required when Feishu is enabled".to_string(),
                        });
                    }

                    if feishu.app_secret.as_deref().unwrap_or("").trim().is_empty() {
                        errors.push(ValidationError {
                            field: "channels.feishu.appSecret".to_string(),
                            message: "Feishu appSecret is required when Feishu is enabled"
                                .to_string(),
                        });
                    }
                }
            }

            if let Some(qq_bridge) = &channels.qq_bridge {
                if qq_bridge.enabled.unwrap_or(false) {
                    let endpoint = qq_bridge.endpoint.as_deref().unwrap_or("").trim();
                    if endpoint.is_empty() {
                        errors.push(ValidationError {
                            field: "channels.qqBridge.endpoint".to_string(),
                            message: "QQ bridge endpoint is required when QQ bridge is enabled"
                                .to_string(),
                        });
                    } else if !endpoint.starts_with("http://")
                        && !endpoint.starts_with("https://")
                        && !endpoint.starts_with("ws://")
                        && !endpoint.starts_with("wss://")
                    {
                        errors.push(ValidationError {
                            field: "channels.qqBridge.endpoint".to_string(),
                            message: "QQ bridge endpoint must start with http://, https://, ws://, or wss://"
                                .to_string(),
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

    pub async fn test_feishu_config(config: &OpenclawConfig) -> Result<ChannelTestResult> {
        let feishu = config
            .channels
            .as_ref()
            .and_then(|channels| channels.feishu.as_ref())
            .ok_or_else(|| AppError::Other("Feishu config is missing".to_string()))?;

        let app_id = feishu.app_id.as_deref().unwrap_or("").trim().to_string();
        let app_secret = feishu
            .app_secret
            .as_deref()
            .unwrap_or("")
            .trim()
            .to_string();

        if app_id.is_empty() || app_secret.is_empty() {
            return Err(AppError::Other(
                "Feishu appId and appSecret are required for testing".to_string(),
            ));
        }

        #[derive(serde::Deserialize)]
        struct FeishuAuthResponse {
            code: i64,
            msg: Option<String>,
            tenant_access_token: Option<String>,
            expire: Option<i64>,
        }

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()?;

        let response = client
            .post("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal")
            .json(&serde_json::json!({
                "app_id": app_id,
                "app_secret": app_secret,
            }))
            .send()
            .await?;

        let status = response.status();
        let body: FeishuAuthResponse = response.json().await?;

        if status.is_success() && body.code == 0 && body.tenant_access_token.is_some() {
            Ok(ChannelTestResult {
                success: true,
                message: "Feishu credential test succeeded".to_string(),
                details: body
                    .expire
                    .map(|expire| format!("tenant_access_token expires in {} seconds", expire)),
            })
        } else {
            Ok(ChannelTestResult {
                success: false,
                message: body
                    .msg
                    .unwrap_or_else(|| "Feishu credential test failed".to_string()),
                details: Some(format!("HTTP status: {} / code: {}", status, body.code)),
            })
        }
    }

    pub async fn test_qq_bridge_config(config: &OpenclawConfig) -> Result<ChannelTestResult> {
        let qq_bridge = config
            .channels
            .as_ref()
            .and_then(|channels| channels.qq_bridge.as_ref())
            .ok_or_else(|| AppError::Other("QQ bridge config is missing".to_string()))?;

        let endpoint = qq_bridge
            .endpoint
            .as_deref()
            .unwrap_or("")
            .trim()
            .to_string();

        if endpoint.is_empty() {
            return Err(AppError::Other(
                "QQ bridge endpoint is required for testing".to_string(),
            ));
        }

        let parsed = reqwest::Url::parse(&endpoint)
            .map_err(|error| AppError::Other(format!("Invalid QQ bridge endpoint: {}", error)))?;

        match parsed.scheme() {
            "http" | "https" => {
                let client = reqwest::Client::builder()
                    .timeout(std::time::Duration::from_secs(8))
                    .build()?;
                let mut request = client.get(parsed.clone());

                if let Some(token) = qq_bridge
                    .access_token
                    .as_deref()
                    .filter(|value| !value.trim().is_empty())
                {
                    request = request.bearer_auth(token);
                }

                let response = request.send().await?;
                let status = response.status();

                Ok(ChannelTestResult {
                    success: status.as_u16() < 500,
                    message: format!("QQ bridge HTTP endpoint responded with {}", status),
                    details: Some("Received an HTTP response from the bridge endpoint".to_string()),
                })
            }
            "ws" | "wss" => {
                let host = parsed.host_str().ok_or_else(|| {
                    AppError::Other("QQ bridge endpoint is missing a host".to_string())
                })?;
                let port = parsed.port_or_known_default().ok_or_else(|| {
                    AppError::Other("QQ bridge endpoint is missing a port".to_string())
                })?;

                tokio::time::timeout(
                    std::time::Duration::from_secs(5),
                    tokio::net::TcpStream::connect((host, port)),
                )
                .await
                .map_err(|_| {
                    AppError::Other("Timed out while connecting to QQ bridge endpoint".to_string())
                })?
                .map_err(|error| {
                    AppError::Other(format!("Failed to reach QQ bridge endpoint: {}", error))
                })?;

                Ok(ChannelTestResult {
                    success: true,
                    message: format!("QQ bridge TCP connection to {}:{} succeeded", host, port),
                    details: Some("WebSocket handshake is not performed yet; this confirms the port is reachable".to_string()),
                })
            }
            scheme => Ok(ChannelTestResult {
                success: false,
                message: format!("Unsupported QQ bridge scheme: {}", scheme),
                details: Some("Use http(s) or ws(s) endpoints".to_string()),
            }),
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
