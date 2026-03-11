use crate::error::{AppError, Result};
use crate::models::message::{Message, SenderType};
use crate::models::room::Room;
use crate::models::task::{Task, TaskStatus};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::fs;
use uuid::Uuid;

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct MindData {
    pub rooms: Vec<Room>,
    pub messages: Vec<Message>,
    pub tasks: Vec<Task>,
}

pub struct MindService {
    data_path: PathBuf,
}

impl MindService {
    pub fn new() -> Self {
        let home = dirs::home_dir().expect("无法获取用户目录");
        let data_path = home.join(".openclaw").join("mind").join("data.json");
        Self { data_path }
    }

    async fn load(&self) -> Result<MindData> {
        if !self.data_path.exists() {
            return Ok(MindData::default());
        }
        let content = fs::read_to_string(&self.data_path).await?;
        let content = content.trim_start_matches('\u{feff}');
        if content.is_empty() {
            return Ok(MindData::default());
        }
        let data: MindData = serde_json::from_str(content)?;
        Ok(data)
    }

    async fn save(&self, data: &MindData) -> Result<()> {
        if let Some(parent) = self.data_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        let content = serde_json::to_string_pretty(data)?;
        fs::write(&self.data_path, content).await?;
        Ok(())
    }

    fn now_secs() -> i64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64
    }

    pub async fn list_rooms(&self) -> Result<Vec<Room>> {
        let data = self.load().await?;
        Ok(data.rooms)
    }

    pub async fn create_room(&self, title: String) -> Result<Room> {
        let mut data = self.load().await?;
        let id = Uuid::new_v4().to_string();
        let room = Room {
            id: id.clone(),
            title,
            created_at: Self::now_secs(),
            agent_ids: vec![],
        };
        data.rooms.push(room.clone());
        self.save(&data).await?;
        Ok(room)
    }

    pub async fn list_messages(&self, room_id: &str) -> Result<Vec<Message>> {
        let data = self.load().await?;
        let mut msgs: Vec<_> = data.messages.iter().filter(|m| m.room_id == room_id).cloned().collect();
        msgs.sort_by_key(|m| m.created_at);
        Ok(msgs)
    }

    pub async fn append_message(
        &self,
        room_id: String,
        sender_type: SenderType,
        sender_id: String,
        content: String,
    ) -> Result<Message> {
        let mut data = self.load().await?;
        let id = Uuid::new_v4().to_string();
        let msg = Message {
            id: id.clone(),
            room_id: room_id.clone(),
            sender_type,
            sender_id,
            content,
            created_at: Self::now_secs(),
            status: "sent".to_string(),
        };
        data.messages.push(msg.clone());
        self.save(&data).await?;
        Ok(msg)
    }

    pub async fn list_tasks(&self, room_id: &str) -> Result<Vec<Task>> {
        let data = self.load().await?;
        let tasks: Vec<_> = data.tasks.iter().filter(|t| t.room_id == room_id).cloned().collect();
        Ok(tasks)
    }

    pub async fn create_task(
        &self,
        room_id: String,
        title: String,
        description: String,
        assignees: Vec<String>,
    ) -> Result<Task> {
        let mut data = self.load().await?;
        let id = Uuid::new_v4().to_string();
        let now = Self::now_secs();
        let task = Task {
            id: id.clone(),
            room_id: room_id.clone(),
            title,
            description,
            assignees,
            status: TaskStatus::Todo,
            created_at: now,
            updated_at: now,
        };
        data.tasks.push(task.clone());
        self.save(&data).await?;
        Ok(task)
    }

    pub async fn update_task_status(&self, task_id: &str, status: TaskStatus) -> Result<Task> {
        let mut data = self.load().await?;
        let task = data
            .tasks
            .iter_mut()
            .find(|t| t.id == task_id)
            .ok_or_else(|| AppError::Other(format!("任务不存在: {}", task_id)))?;
        task.status = status;
        task.updated_at = Self::now_secs();
        let cloned = task.clone();
        self.save(&data).await?;
        Ok(cloned)
    }

    pub async fn update_room_agents(&self, room_id: &str, agent_ids: Vec<String>) -> Result<Room> {
        let mut data = self.load().await?;
        let room = data
            .rooms
            .iter_mut()
            .find(|r| r.id == room_id)
            .ok_or_else(|| AppError::Other(format!("房间不存在: {}", room_id)))?;
        room.agent_ids = agent_ids;
        let cloned = room.clone();
        self.save(&data).await?;
        Ok(cloned)
    }
}
