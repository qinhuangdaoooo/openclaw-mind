use crate::models::config::OpenclawConfig;
use crate::services::config_service::{ConfigService, ValidationResult};
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
        },
        Err(e) => {
            println!("Failed to read config: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub async fn write_config(
    config: OpenclawConfig,
    config_service: State<'_, ConfigService>,
) -> Result<(), String> {
    config_service.write(&config).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn validate_config_json(json_str: String) -> Result<ValidationResult, String> {
    ConfigService::validate_json(&json_str).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reload_gateway(
    config_service: State<'_, ConfigService>,
) -> Result<String, String> {
    config_service.reload_gateway().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_providers(
    config_service: State<'_, ConfigService>,
) -> Result<Vec<ProviderInfo>, String> {
    println!("get_providers called");
    
    let config = match config_service.read().await {
        Ok(c) => {
            println!("Config read successfully");
            c
        },
        Err(e) => {
            println!("Failed to read config: {}", e);
            return Err(format!("Failed to read config: {}", e));
        }
    };
    
    let default_provider = config
        .agents
        .as_ref()
        .and_then(|a| a.defaults.as_ref())
        .and_then(|d| d.model.as_ref())
        .and_then(|m| m.primary.as_ref())
        .map(|s| s.as_str());
    
    println!("Default provider: {:?}", default_provider);
    
    let mut providers = Vec::new();
    
    if let Some(models) = config.models {
        println!("Found models config with {} providers", models.providers.len());
        for (id, provider_config) in models.providers {
            let name = match id.as_str() {
                "deepseek" => "DeepSeek",
                "kimi" => "Kimi (Moonshot)",
                "openai" => "OpenAI",
                "anthropic" => "Anthropic",
                "zhipu" => "智谱 AI",
                "qwen" => "通义千问",
                _ => &id,
            };
            
            providers.push(ProviderInfo {
                id: id.clone(),
                name: name.to_string(),
                api: provider_config.api,
                has_api_key: provider_config.api_key.is_some(),
                is_default: default_provider == Some(id.as_str()),
            });
        }
    } else {
        println!("No models config found");
    }
    
    println!("Returning {} providers", providers.len());
    Ok(providers)
}

#[tauri::command]
pub async fn set_default_provider(
    provider_id: String,
    config_service: State<'_, ConfigService>,
) -> Result<(), String> {
    let mut config = config_service.read().await.map_err(|e| e.to_string())?;
    
    // 确保 agents 结构存在
    if config.agents.is_none() {
        config.agents = Some(crate::models::config::AgentsConfig {
            defaults: None,
            list: None,
        });
    }
    
    let agents = config.agents.as_mut().unwrap();
    
    if agents.defaults.is_none() {
        agents.defaults = Some(crate::models::config::AgentDefaults {
            workspace: None,
            model: None,
        });
    }
    
    let defaults = agents.defaults.as_mut().unwrap();
    
    if defaults.model.is_none() {
        defaults.model = Some(crate::models::config::ModelConfig {
            primary: None,
        });
    }
    
    let model = defaults.model.as_mut().unwrap();
    model.primary = Some(provider_id);
    
    config_service.write(&config).await.map_err(|e| e.to_string())
}
