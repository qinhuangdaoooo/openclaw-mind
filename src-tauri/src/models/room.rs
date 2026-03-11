use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Room {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    /// 接入本房间的 Agent ID 列表
    #[serde(default)]
    pub agent_ids: Vec<String>,
}
