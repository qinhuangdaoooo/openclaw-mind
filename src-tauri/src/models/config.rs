use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct OpenclawConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<HashMap<String, Value>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<HashMap<String, String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub gateway: Option<GatewayConfig>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub models: Option<ModelsConfig>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub agents: Option<AgentsConfig>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub bindings: Option<Vec<BindingConfig>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub channels: Option<ChannelsConfig>,

    #[serde(rename = "canvasHost", alias = "canvas_host", skip_serializing_if = "Option::is_none")]
    pub canvas_host: Option<CanvasHostConfig>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub messages: Option<MessagesConfig>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<ToolsConfig>,

    #[serde(default, flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GatewayConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth: Option<AuthConfig>,

    #[serde(default, flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AuthConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,

    #[serde(default, flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ModelsConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,

    #[serde(default)]
    pub providers: HashMap<String, ProviderConfig>,

    #[serde(default, flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ProviderConfig {
    #[serde(default)]
    pub api: String,

    #[serde(rename = "apiKey", alias = "api_key", skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,

    #[serde(rename = "baseUrl", alias = "base_url", skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub models: Option<Vec<ProviderModelEntry>>,

    #[serde(default, flatten)]
    pub extra: HashMap<String, Value>,
}

impl ProviderConfig {
    pub fn api_key_value(&self) -> Option<&str> {
        self.api_key.as_deref()
    }

    pub fn base_url_value(&self) -> Option<&str> {
        self.base_url.as_deref().or_else(|| {
            if self.api.starts_with("http://") || self.api.starts_with("https://") {
                Some(self.api.as_str())
            } else {
                None
            }
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ProviderModelEntry {
    Id(String),
    Detail(ProviderModelConfig),
}

impl ProviderModelEntry {
    pub fn model_id(&self) -> Option<&str> {
        match self {
            Self::Id(id) => Some(id.as_str()),
            Self::Detail(model) => model.id.as_deref().or(model.name.as_deref()),
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ProviderModelConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub api: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub input: Option<Vec<String>>,

    #[serde(rename = "contextWindow", alias = "context_window", skip_serializing_if = "Option::is_none")]
    pub context_window: Option<u64>,

    #[serde(rename = "maxTokens", alias = "max_tokens", skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u64>,

    #[serde(default, flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AgentsConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub defaults: Option<AgentDefaults>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub list: Option<Vec<AgentConfig>>,

    #[serde(default, flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AgentDefaults {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<ModelConfig>,

    #[serde(default, flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AgentConfig {
    pub id: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<ModelConfig>,

    #[serde(default, flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ModelConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub fallbacks: Option<Vec<String>>,

    #[serde(default, flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BindingConfig {
    #[serde(rename = "agentId", alias = "agent_id")]
    pub agent_id: String,

    #[serde(default)]
    pub r#match: BindingMatchConfig,

    #[serde(default, flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BindingMatchConfig {
    #[serde(default)]
    pub channel: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub peer: Option<BindingPeerConfig>,

    #[serde(default, flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BindingPeerConfig {
    #[serde(default)]
    pub kind: String,

    #[serde(default)]
    pub id: String,

    #[serde(default, flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ChannelsConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub feishu: Option<Value>,

    #[serde(rename = "qqBridge", alias = "qq_bridge", skip_serializing_if = "Option::is_none")]
    pub qq_bridge: Option<Value>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub whatsapp: Option<Value>,

    #[serde(default, flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CanvasHostConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enabled: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,

    #[serde(default, flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MessagesConfig {
    #[serde(rename = "groupChat", alias = "group_chat", skip_serializing_if = "Option::is_none")]
    pub group_chat: Option<GroupChatConfig>,

    #[serde(default, flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GroupChatConfig {
    #[serde(rename = "mentionPatterns", alias = "mention_patterns", skip_serializing_if = "Option::is_none")]
    pub mention_patterns: Option<Vec<String>>,

    #[serde(default, flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ToolsConfig {
    #[serde(rename = "agentToAgent", alias = "agent_to_agent", skip_serializing_if = "Option::is_none")]
    pub agent_to_agent: Option<AgentToAgentConfig>,

    #[serde(default, flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AgentToAgentConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enabled: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow: Option<Vec<String>>,

    #[serde(default, flatten)]
    pub extra: HashMap<String, Value>,
}

#[cfg(test)]
mod tests {
    use super::OpenclawConfig;

    #[test]
    fn parses_object_model_entries_and_preserves_unknown_root_fields() {
        let raw = r#"
        {
          "wizard": { "lastRunCommand": "doctor" },
          "browser": { "enabled": true },
          "models": {
            "mode": "merge",
            "providers": {
              "claudeaws": {
                "api": "openai-responses",
                "apiKey": "${CLAUDEAWS_API_KEY}",
                "baseUrl": "https://example.com/v1",
                "models": [
                  {
                    "id": "gpt-5.4",
                    "name": "gpt-5.4",
                    "contextWindow": 1000000
                  }
                ]
              }
            }
          }
        }
        "#;

        let config: OpenclawConfig = serde_json::from_str(raw).expect("config should parse");
        let provider = config
            .models
            .as_ref()
            .and_then(|models| models.providers.get("claudeaws"))
            .expect("provider should exist");

        let model_id = provider
            .models
            .as_ref()
            .and_then(|models| models.first())
            .and_then(|model| model.model_id());

        assert_eq!(provider.api_key.as_deref(), Some("${CLAUDEAWS_API_KEY}"));
        assert_eq!(provider.base_url.as_deref(), Some("https://example.com/v1"));
        assert_eq!(model_id, Some("gpt-5.4"));
        assert!(config.extra.contains_key("wizard"));
        assert!(config.extra.contains_key("browser"));
    }
}
