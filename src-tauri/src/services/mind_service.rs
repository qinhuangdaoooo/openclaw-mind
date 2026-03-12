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
        let home = dirs::home_dir().expect("Failed to locate home directory");
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
        let room = Room {
            id: Uuid::new_v4().to_string(),
            title,
            created_at: Self::now_secs(),
            agent_ids: vec![],
            channel: None,
            peer_id: None,
            external_key: None,
        };
        data.rooms.push(room.clone());
        self.save(&data).await?;
        Ok(room)
    }

    pub async fn list_messages(&self, room_id: &str) -> Result<Vec<Message>> {
        let data = self.load().await?;
        let mut messages: Vec<_> = data
            .messages
            .iter()
            .filter(|message| message.room_id == room_id)
            .cloned()
            .collect();
        messages.sort_by_key(|message| message.created_at);
        Ok(messages)
    }

    pub async fn append_message(
        &self,
        room_id: String,
        sender_type: SenderType,
        sender_id: String,
        content: String,
    ) -> Result<Message> {
        let mut data = self.load().await?;
        let message = Message {
            id: Uuid::new_v4().to_string(),
            room_id,
            sender_type,
            sender_id,
            content,
            created_at: Self::now_secs(),
            status: "sent".to_string(),
        };
        data.messages.push(message.clone());
        self.save(&data).await?;
        Ok(message)
    }

    pub async fn list_tasks(&self, room_id: &str) -> Result<Vec<Task>> {
        let data = self.load().await?;
        Ok(data
            .tasks
            .iter()
            .filter(|task| task.room_id == room_id)
            .cloned()
            .collect())
    }

    pub async fn create_task(
        &self,
        room_id: String,
        title: String,
        description: String,
        assignees: Vec<String>,
    ) -> Result<Task> {
        let mut data = self.load().await?;
        let now = Self::now_secs();
        let task = Task {
            id: Uuid::new_v4().to_string(),
            room_id,
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
            .find(|task| task.id == task_id)
            .ok_or_else(|| AppError::Other(format!("Task not found: {}", task_id)))?;
        task.status = status;
        task.updated_at = Self::now_secs();
        let cloned = task.clone();
        self.save(&data).await?;
        Ok(cloned)
    }

    pub async fn ingest_channel_message(
        &self,
        external_key: String,
        title: String,
        channel: String,
        peer_id: Option<String>,
        agent_ids: Vec<String>,
        sender_id: String,
        content: String,
    ) -> Result<(Room, Message)> {
        let mut data = self.load().await?;

        let room = if let Some(existing) = data
            .rooms
            .iter_mut()
            .find(|room| room.external_key.as_deref() == Some(external_key.as_str()))
        {
            if !title.trim().is_empty() {
                existing.title = title.clone();
            }
            if !agent_ids.is_empty() {
                existing.agent_ids = agent_ids.clone();
            }
            existing.channel = Some(channel.clone());
            existing.peer_id = peer_id.clone();
            existing.clone()
        } else {
            let room = Room {
                id: Uuid::new_v4().to_string(),
                title: title.clone(),
                created_at: Self::now_secs(),
                agent_ids: agent_ids.clone(),
                channel: Some(channel.clone()),
                peer_id: peer_id.clone(),
                external_key: Some(external_key.clone()),
            };
            data.rooms.push(room.clone());
            room
        };

        let message = Message {
            id: Uuid::new_v4().to_string(),
            room_id: room.id.clone(),
            sender_type: SenderType::Human,
            sender_id,
            content,
            created_at: Self::now_secs(),
            status: "received".to_string(),
        };

        data.messages.push(message.clone());
        self.save(&data).await?;
        Ok((room, message))
    }

    pub async fn update_room_agents(&self, room_id: &str, agent_ids: Vec<String>) -> Result<Room> {
        let mut data = self.load().await?;
        let room = data
            .rooms
            .iter_mut()
            .find(|room| room.id == room_id)
            .ok_or_else(|| AppError::Other(format!("Room not found: {}", room_id)))?;
        room.agent_ids = agent_ids;
        let cloned = room.clone();
        self.save(&data).await?;
        Ok(cloned)
    }
}
