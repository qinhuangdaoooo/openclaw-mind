use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Todo,
    InProgress,
    Done,
    Blocked,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub room_id: String,
    pub title: String,
    pub description: String,
    pub assignees: Vec<String>,
    pub status: TaskStatus,
    pub created_at: i64,
    pub updated_at: i64,
}
