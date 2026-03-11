use crate::models::message::{Message, SenderType};
use crate::models::room::Room;
use crate::models::task::{Task, TaskStatus};
use crate::services::agent_service::AgentService;
use crate::services::ai_service::AiService;
use crate::services::config_service::ConfigService;
use crate::services::mind_service::MindService;
use serde_json::json;
use tauri::State;

fn parse_sender_type(s: &str) -> SenderType {
    match s.to_lowercase().as_str() {
        "agent" => SenderType::Agent,
        "system" => SenderType::System,
        _ => SenderType::Human,
    }
}

/// 确保 base_url 以 /v1 结尾，OpenAI 兼容 API 标准路径
fn normalize_base_url(url: &str) -> String {
    let u = url.trim().trim_end_matches('/');
    if u.is_empty() {
        return url.to_string();
    }
    // 若已包含 /v1、/v2 等则不追加
    if u.ends_with("/v1")
        || u.ends_with("/v2")
        || u.ends_with("/v3")
        || u.contains("/v1/")
        || u.contains("/v2/")
        || u.contains("/v3/")
    {
        return u.to_string();
    }
    format!("{}/v1", u)
}

fn parse_task_status(s: &str) -> TaskStatus {
    match s.to_lowercase().replace("-", "_").as_str() {
        "in_progress" => TaskStatus::InProgress,
        "done" => TaskStatus::Done,
        "blocked" => TaskStatus::Blocked,
        _ => TaskStatus::Todo,
    }
}

#[tauri::command]
pub async fn list_rooms(mind_service: State<'_, MindService>) -> Result<Vec<Room>, String> {
    mind_service.list_rooms().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_room(
    title: String,
    mind_service: State<'_, MindService>,
) -> Result<Room, String> {
    mind_service.create_room(title).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_messages(
    room_id: String,
    mind_service: State<'_, MindService>,
) -> Result<Vec<Message>, String> {
    mind_service.list_messages(&room_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn append_message(
    room_id: String,
    sender_type: String,
    sender_id: String,
    content: String,
    mind_service: State<'_, MindService>,
) -> Result<Message, String> {
    mind_service
        .append_message(room_id, parse_sender_type(&sender_type), sender_id, content)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_tasks(
    room_id: String,
    mind_service: State<'_, MindService>,
) -> Result<Vec<Task>, String> {
    mind_service.list_tasks(&room_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_task(
    room_id: String,
    title: String,
    description: String,
    assignees: Vec<String>,
    mind_service: State<'_, MindService>,
) -> Result<Task, String> {
    mind_service
        .create_task(room_id, title, description, assignees)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_task_status(
    task_id: String,
    status: String,
    mind_service: State<'_, MindService>,
) -> Result<Task, String> {
    mind_service
        .update_task_status(&task_id, parse_task_status(&status))
        .await
        .map_err(|e| e.to_string())
}

/// 在房间中调用指定 Agent，基于对话历史生成回复并追加为消息
#[tauri::command]
pub async fn invoke_agent(
    room_id: String,
    agent_id: String,
    config_service: State<'_, ConfigService>,
    agent_service: State<'_, AgentService>,
    mind_service: State<'_, MindService>,
) -> Result<Message, String> {
    let config = config_service.read().await.map_err(|e| e.to_string())?;

    // 获取 Provider 配置
    let provider_id = config
        .agents
        .as_ref()
        .and_then(|a| a.list.as_ref())
        .and_then(|list| list.iter().find(|ac| ac.id == agent_id))
        .and_then(|ac| ac.model.as_ref())
        .and_then(|m| m.primary.as_ref())
        .or_else(|| {
            config
                .agents
                .as_ref()
                .and_then(|a| a.defaults.as_ref())
                .and_then(|d| d.model.as_ref())
                .and_then(|m| m.primary.as_ref())
        })
        .cloned()
        .ok_or_else(|| "请先在配置中设置默认模型 Provider".to_string())?;

    let providers = config
        .models
        .as_ref()
        .map(|m| &m.providers)
        .ok_or_else(|| "配置中未找到 models.providers".to_string())?;

    let provider_config = providers
        .get(&provider_id)
        .ok_or_else(|| format!("未找到 Provider: {}", provider_id))?;

    let api_key = provider_config
        .api_key
        .as_deref()
        .ok_or_else(|| format!("Provider {} 未配置 API Key", provider_id))?;

    let base_url = provider_config
        .base_url
        .as_deref()
        .unwrap_or_else(|| provider_config.api.as_str());
    let base_url = normalize_base_url(base_url);

    // 加载房间消息
    let room_messages = mind_service
        .list_messages(&room_id)
        .await
        .map_err(|e| e.to_string())?;

    // 加载 Agent 的 system prompt，并加上「只代表自己发言」的约束
    let agent_files = agent_service.read_files(&agent_id).await.ok();
    let base_system = agent_files
        .and_then(|f| f.system)
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| {
            format!(
                "你是群聊中的 Agent「{}」。请根据对话上下文简短、自然地回复。",
                agent_id
            )
        });
    let system_content = format!(
        "{}\n\n【重要】你只代表自己发言：直接给出你的回复内容，不要代替其他成员发言，不要列举或写出「@某某：回复」这类格式。",
        base_system.trim()
    );

    // 构建 OpenAI 格式的 messages
    let mut messages: Vec<serde_json::Value> = vec![json!({
        "role": "system",
        "content": system_content
    })];

    for m in &room_messages {
        let role = match m.sender_type {
            crate::models::message::SenderType::Human => "user",
            crate::models::message::SenderType::Agent => "assistant",
            crate::models::message::SenderType::System => "system",
        };
        messages.push(json!({
            "role": role,
            "content": m.content
        }));
    }

    // 调用 LLM
    let model = provider_config
        .models
        .as_ref()
        .and_then(|v| v.first())
        .map(|s| s.as_str());

    let agent_response = AiService::chat_completion(
        api_key,
        &base_url,
        model,
        &provider_id,
        messages,
    )
    .await
    .map_err(|e| e.to_string())?;

    // 追加 Agent 回复到房间
    let msg = mind_service
        .append_message(
            room_id,
            SenderType::Agent,
            agent_id.clone(),
            agent_response,
        )
        .await
        .map_err(|e| e.to_string())?;

    Ok(msg)
}

#[tauri::command]
pub async fn update_room_agents(
    room_id: String,
    agent_ids: Vec<String>,
    mind_service: State<'_, MindService>,
) -> Result<Room, String> {
    mind_service
        .update_room_agents(&room_id, agent_ids)
        .await
        .map_err(|e| e.to_string())
}
