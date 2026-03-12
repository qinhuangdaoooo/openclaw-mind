use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct OpenclawConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<HashMap<String, Value>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<HashMap<String, String>>,

    #[serde(rename = "canvasHost", skip_serializing_if = "Option::is_none")]
    pub canvas_host: Option<CanvasHostConfig>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub gateway: Option<GatewayConfig>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub models: Option<ModelsConfig>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub agents: Option<AgentsConfig>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub bindings: Option<Vec<BindingConfig>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<ToolsConfig>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub channels: Option<ChannelsConfig>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub messages: Option<MessagesConfig>,

    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CanvasHostConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enabled: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,

    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GatewayConfig {
    #[serde(default)]
    pub mode: String,

    #[serde(default)]
    pub port: u16,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth: Option<AuthConfig>,

    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AuthConfig {
    #[serde(default)]
    pub mode: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,

    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ModelsConfig {
    #[serde(default)]
    pub mode: String,

    #[serde(default)]
    pub providers: HashMap<String, ProviderConfig>,

    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ProviderConfig {
    #[serde(default)]
    pub api: String,

    #[serde(
        rename = "apiKey",
        alias = "api_key",
        skip_serializing_if = "Option::is_none"
    )]
    pub api_key: Option<String>,

    #[serde(
        rename = "baseUrl",
        alias = "base_url",
        skip_serializing_if = "Option::is_none"
    )]
    pub base_url: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub models: Option<Vec<ProviderModelEntry>>,

    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ProviderModelEntry {
    Id(String),
    Detailed(ProviderModelDetails),
}

impl ProviderModelEntry {
    pub fn model_id(&self) -> &str {
        match self {
            Self::Id(value) => value.as_str(),
            Self::Detailed(details) => details.id.as_str(),
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ProviderModelDetails {
    pub id: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub api: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub input: Option<Vec<String>>,

    #[serde(rename = "contextWindow", skip_serializing_if = "Option::is_none")]
    pub context_window: Option<u64>,

    #[serde(rename = "maxTokens", skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u64>,

    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AgentsConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub defaults: Option<AgentDefaults>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub list: Option<Vec<AgentConfig>>,

    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AgentDefaults {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<ModelConfig>,

    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
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

    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ModelConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary: Option<String>,

    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BindingConfig {
    #[serde(rename = "agentId")]
    pub agent_id: String,

    #[serde(rename = "match")]
    pub matcher: BindingMatchConfig,

    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BindingMatchConfig {
    #[serde(default)]
    pub channel: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub peer: Option<BindingPeerConfig>,

    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BindingPeerConfig {
    #[serde(default)]
    pub kind: String,

    #[serde(default)]
    pub id: String,

    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ToolsConfig {
    #[serde(rename = "agentToAgent", skip_serializing_if = "Option::is_none")]
    pub agent_to_agent: Option<AgentToAgentConfig>,

    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AgentToAgentConfig {
    #[serde(default)]
    pub enabled: bool,

    #[serde(default)]
    pub allow: Vec<String>,

    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ChannelsConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub whatsapp: Option<WhatsappChannelConfig>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub feishu: Option<FeishuChannelConfig>,

    #[serde(rename = "qqBridge", skip_serializing_if = "Option::is_none")]
    pub qq_bridge: Option<QqBridgeChannelConfig>,

    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct WhatsappChannelConfig {
    #[serde(rename = "groupPolicy", skip_serializing_if = "Option::is_none")]
    pub group_policy: Option<String>,

    #[serde(rename = "allowFrom", skip_serializing_if = "Option::is_none")]
    pub allow_from: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub groups: Option<HashMap<String, MentionRuleConfig>>,

    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FeishuChannelConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enabled: Option<bool>,

    #[serde(rename = "appId", skip_serializing_if = "Option::is_none")]
    pub app_id: Option<String>,

    #[serde(rename = "appSecret", skip_serializing_if = "Option::is_none")]
    pub app_secret: Option<String>,

    #[serde(rename = "verificationToken", skip_serializing_if = "Option::is_none")]
    pub verification_token: Option<String>,

    #[serde(rename = "encryptKey", skip_serializing_if = "Option::is_none")]
    pub encrypt_key: Option<String>,

    #[serde(rename = "defaultChatId", skip_serializing_if = "Option::is_none")]
    pub default_chat_id: Option<String>,

    #[serde(rename = "groupPolicy", skip_serializing_if = "Option::is_none")]
    pub group_policy: Option<String>,

    #[serde(rename = "allowChats", skip_serializing_if = "Option::is_none")]
    pub allow_chats: Option<Vec<String>>,

    #[serde(rename = "requireMention", skip_serializing_if = "Option::is_none")]
    pub require_mention: Option<bool>,

    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct QqBridgeChannelConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enabled: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub endpoint: Option<String>,

    #[serde(rename = "accessToken", skip_serializing_if = "Option::is_none")]
    pub access_token: Option<String>,

    #[serde(rename = "selfId", skip_serializing_if = "Option::is_none")]
    pub self_id: Option<String>,

    #[serde(rename = "groupPolicy", skip_serializing_if = "Option::is_none")]
    pub group_policy: Option<String>,

    #[serde(rename = "allowGroups", skip_serializing_if = "Option::is_none")]
    pub allow_groups: Option<Vec<String>>,

    #[serde(rename = "requireMention", skip_serializing_if = "Option::is_none")]
    pub require_mention: Option<bool>,

    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MentionRuleConfig {
    #[serde(rename = "requireMention", skip_serializing_if = "Option::is_none")]
    pub require_mention: Option<bool>,

    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MessagesConfig {
    #[serde(rename = "groupChat", skip_serializing_if = "Option::is_none")]
    pub group_chat: Option<GroupChatConfig>,

    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GroupChatConfig {
    #[serde(rename = "mentionPatterns", skip_serializing_if = "Option::is_none")]
    pub mention_patterns: Option<Vec<String>>,

    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
    pub extra: HashMap<String, Value>,
}
