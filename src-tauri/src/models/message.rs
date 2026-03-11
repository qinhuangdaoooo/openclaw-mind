use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SenderType {
    Human,
    Agent,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub room_id: String,
    pub sender_type: SenderType,
    pub sender_id: String,
    pub content: String,
    pub created_at: i64,
    #[serde(default)]
    pub status: String,
}
