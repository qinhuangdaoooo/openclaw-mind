use crate::models::config::OpenclawConfig;
use crate::services::config_service::{ChannelTestResult, ConfigService, ValidationResult};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderInfo {
    pub id: String,
    pub name: String,
    pub api: String,
    pub has_api_key: bool,
    pub is_default: bool,
}

#[tauri::command]
pub async fn read_config(
    config_service: State<'_, ConfigService>,
) -> Result<OpenclawConfig, String> {
    println!("read_config called");
    match config_service.read().await {
        Ok(config) => {
            println!("Config read successfully");
            Ok(config)
        }
        Err(error) => {
            println!("Failed to read config: {}", error);
            Err(error.to_string())
        }
    }
}

#[tauri::command]
pub async fn write_config(
    config: OpenclawConfig,
    config_service: State<'_, ConfigService>,
) -> Result<(), String> {
    config_service
        .write(&config)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn validate_config_json(json_str: String) -> Result<ValidationResult, String> {
    ConfigService::validate_json(&json_str).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn reload_gateway(config_service: State<'_, ConfigService>) -> Result<String, String> {
    config_service
        .reload_gateway()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn test_feishu_config(config: OpenclawConfig) -> Result<ChannelTestResult, String> {
    ConfigService::test_feishu_config(&config)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn test_qq_bridge_config(config: OpenclawConfig) -> Result<ChannelTestResult, String> {
    ConfigService::test_qq_bridge_config(&config)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_providers(
    config_service: State<'_, ConfigService>,
) -> Result<Vec<ProviderInfo>, String> {
    println!("get_providers called");

    let config = match config_service.read().await {
        Ok(config) => {
            println!("Config read successfully");
            config
        }
        Err(error) => {
            println!("Failed to read config: {}", error);
            return Err(format!("Failed to read config: {}", error));
        }
    };

    let default_provider = config
        .agents
        .as_ref()
        .and_then(|agents| agents.defaults.as_ref())
        .and_then(|defaults| defaults.model.as_ref())
        .and_then(|model| model.primary.as_ref())
        .map(|value| value.split('/').next().unwrap_or(value.as_str()));

    let mut providers = Vec::new();

    if let Some(models) = config.models {
        for (id, provider_config) in models.providers {
            let name = match id.as_str() {
                "deepseek" => "DeepSeek",
                "kimi" => "Kimi (Moonshot)",
                "openai" => "OpenAI",
                "anthropic" => "Anthropic",
                "zhipu" => "Zhipu AI",
                "qwen" => "Qwen",
                _ => &id,
            };

            providers.push(ProviderInfo {
                id: id.clone(),
                name: name.to_string(),
                api: provider_config
                    .base_url
                    .clone()
                    .unwrap_or_else(|| provider_config.api.clone()),
                has_api_key: provider_config.api_key.is_some(),
                is_default: default_provider == Some(id.as_str()),
            });
        }
    }

    Ok(providers)
}

#[tauri::command]
pub async fn set_default_provider(
    provider_id: String,
    config_service: State<'_, ConfigService>,
) -> Result<(), String> {
    let mut config = config_service
        .read()
        .await
        .map_err(|error| error.to_string())?;

    if config.agents.is_none() {
        config.agents = Some(crate::models::config::AgentsConfig {
            defaults: None,
            list: None,
            ..Default::default()
        });
    }

    let agents = config.agents.as_mut().unwrap();

    if agents.defaults.is_none() {
        agents.defaults = Some(crate::models::config::AgentDefaults {
            workspace: None,
            model: None,
            ..Default::default()
        });
    }

    let defaults = agents.defaults.as_mut().unwrap();

    if defaults.model.is_none() {
        defaults.model = Some(crate::models::config::ModelConfig {
            primary: None,
            ..Default::default()
        });
    }

    let model = defaults.model.as_mut().unwrap();
    model.primary = Some(provider_id);

    config_service
        .write(&config)
        .await
        .map_err(|error| error.to_string())
}
