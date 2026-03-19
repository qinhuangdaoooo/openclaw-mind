use crate::models::message::{Message, SenderType};
use crate::models::room::Room;
use crate::models::task::{Task, TaskStatus};
use crate::services::agent_service::AgentService;
use crate::services::ai_service::AiService;
use crate::services::config_service::ConfigService;
use crate::services::mind_service::MindService;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::path::{Component, Path, PathBuf};
use tauri::State;
use tokio::fs;

const ACTION_TAG_START: &str = "<file-actions>";
const ACTION_TAG_END: &str = "</file-actions>";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AgentActionEnvelope {
    actions: Vec<AgentFileAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AgentFileAction {
    #[serde(rename = "type")]
    action_type: String,
    path: String,
    #[serde(default)]
    content: String,
}

fn get_agent_display_name(
    config: &crate::models::config::OpenclawConfig,
    agent_id: &str,
) -> String {
    config
        .agents
        .as_ref()
        .and_then(|a| a.list.as_ref())
        .and_then(|list| list.iter().find(|ac| ac.id == agent_id))
        .and_then(|ac| ac.name.clone())
        .filter(|name| !name.trim().is_empty())
        .unwrap_or_else(|| agent_id.to_string())
}

fn parse_sender_type(s: &str) -> SenderType {
    match s.to_lowercase().as_str() {
        "agent" => SenderType::Agent,
        "system" => SenderType::System,
        _ => SenderType::Human,
    }
}

fn normalize_base_url(url: &str) -> String {
    let u = url.trim().trim_end_matches('/');
    if u.is_empty() {
        return url.to_string();
    }
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

fn is_explicit_file_creation_request(text: &str) -> bool {
    let normalized = text.to_lowercase();
    let keywords = [
        "直接创建文件",
        "直接创建",
        "帮我创建文件",
        "写入文件",
        "落盘",
        "别贴代码",
        "不要贴代码",
        "直接落地",
        "直接写到文件夹",
        "create file",
        "write file",
        "write files",
        "save to folder",
        "save into",
        "do not paste code",
    ];

    keywords.iter().any(|keyword| normalized.contains(keyword))
}

fn looks_like_file_action_refusal(text: &str) -> bool {
    let normalized = text.to_lowercase();
    let patterns = [
        "不能创建文件",
        "不能直接创建",
        "不能写入文件",
        "无法创建文件",
        "无法直接创建",
        "没有写入能力",
        "没有 file-actions",
        "未绑定项目目录",
        "can't create file",
        "can't write file",
        "cannot create file",
        "cannot write file",
        "no file-actions",
        "no write access",
        "cannot directly create",
    ];

    patterns.iter().any(|pattern| normalized.contains(pattern))
}

fn extract_actions_from_response(content: &str) -> Result<(String, Vec<AgentFileAction>), String> {
    let Some(start) = content.find(ACTION_TAG_START) else {
        return Ok((content.trim().to_string(), Vec::new()));
    };
    let Some(end) = content.find(ACTION_TAG_END) else {
        return Err("Agent returned an unclosed file action block.".to_string());
    };
    if end < start {
        return Err("Agent returned an invalid file action block.".to_string());
    }

    let json_part = content[start + ACTION_TAG_START.len()..end].trim();
    let envelope: AgentActionEnvelope = serde_json::from_str(json_part)
        .map_err(|e| format!("Failed to parse agent file actions: {}", e))?;

    let before = content[..start].trim();
    let after = content[end + ACTION_TAG_END.len()..].trim();
    let visible = match (before.is_empty(), after.is_empty()) {
        (true, true) => String::new(),
        (false, true) => before.to_string(),
        (true, false) => after.to_string(),
        (false, false) => format!("{}\n\n{}", before, after),
    };

    Ok((visible, envelope.actions))
}

fn resolve_project_relative_path(project_root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let trimmed = relative_path.trim();
    if trimmed.is_empty() {
        return Err("File path cannot be empty.".to_string());
    }

    let candidate = Path::new(trimmed);
    if candidate.is_absolute() {
        return Err(format!("Absolute paths are not allowed: {}", trimmed));
    }

    let mut safe_relative = PathBuf::new();
    for component in candidate.components() {
        match component {
            Component::Normal(part) => safe_relative.push(part),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(format!("Path escapes the project directory: {}", trimmed));
            }
        }
    }

    if safe_relative.as_os_str().is_empty() {
        return Err("File path cannot be empty.".to_string());
    }

    Ok(project_root.join(safe_relative))
}

async fn execute_agent_actions(
    project_path: &str,
    actions: &[AgentFileAction],
) -> Result<Vec<String>, String> {
    let project_root = PathBuf::from(project_path.trim());
    if project_root.as_os_str().is_empty() {
        return Err("Current room has no project directory bound.".to_string());
    }

    fs::create_dir_all(&project_root)
        .await
        .map_err(|e| format!("Failed to prepare project directory: {}", e))?;

    let mut summaries = Vec::new();

    for action in actions {
        let resolved = resolve_project_relative_path(&project_root, &action.path)?;
        match action.action_type.as_str() {
            "mkdir" => {
                fs::create_dir_all(&resolved)
                    .await
                    .map_err(|e| format!("Failed to create directory {}: {}", action.path, e))?;
                summaries.push(format!("Created directory `{}`", action.path));
            }
            "write_file" => {
                if let Some(parent) = resolved.parent() {
                    fs::create_dir_all(parent).await.map_err(|e| {
                        format!("Failed to create parent directory for {}: {}", action.path, e)
                    })?;
                }
                fs::write(&resolved, &action.content)
                    .await
                    .map_err(|e| format!("Failed to write file {}: {}", action.path, e))?;
                summaries.push(format!("Wrote file `{}`", action.path));
            }
            other => {
                return Err(format!("Unsupported file action type: {}", other));
            }
        }
    }

    Ok(summaries)
}

#[tauri::command]
pub async fn list_rooms(mind_service: State<'_, MindService>) -> Result<Vec<Room>, String> {
    mind_service.list_rooms().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_room(
    title: String,
    project_path: Option<String>,
    mind_service: State<'_, MindService>,
) -> Result<Room, String> {
    mind_service
        .create_room(title, project_path)
        .await
        .map_err(|e| e.to_string())
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

#[tauri::command]
pub async fn invoke_agent(
    room_id: String,
    agent_id: String,
    config_service: State<'_, ConfigService>,
    agent_service: State<'_, AgentService>,
    mind_service: State<'_, MindService>,
) -> Result<Message, String> {
    let config = config_service.read().await.map_err(|e| e.to_string())?;
    let current_room = mind_service
        .list_rooms()
        .await
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|room| room.id == room_id);

    let provider_ref = config
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
        .ok_or_else(|| "Please configure a default model provider first.".to_string())?;

    let (provider_id, model_from_ref) = match provider_ref.split_once('/') {
        Some((provider, model)) => (provider.to_string(), Some(model.to_string())),
        None => (provider_ref.clone(), None),
    };

    let providers = config
        .models
        .as_ref()
        .map(|m| &m.providers)
        .ok_or_else(|| "Could not find models.providers in config.".to_string())?;

    let provider_config = providers
        .get(&provider_id)
        .ok_or_else(|| format!("Provider not found: {}", provider_id))?;

    let api_key = provider_config
        .api_key_value()
        .ok_or_else(|| format!("Provider {} is missing an API key.", provider_id))?;

    let base_url = provider_config
        .base_url_value()
        .unwrap_or_else(|| provider_config.api.as_str());
    let base_url = normalize_base_url(base_url);

    let room_messages = mind_service
        .list_messages(&room_id)
        .await
        .map_err(|e| e.to_string())?;
    let latest_human_message = room_messages
        .iter()
        .rev()
        .find(|message| matches!(message.sender_type, SenderType::Human))
        .map(|message| message.content.as_str())
        .unwrap_or("");
    let project_path = current_room
        .as_ref()
        .and_then(|room| room.project_path.as_ref())
        .map(|path| path.trim().to_string())
        .filter(|path| !path.is_empty());
    let requires_file_actions =
        project_path.is_some() && is_explicit_file_creation_request(latest_human_message);

    let agent_files = agent_service.read_files(&agent_id).await.ok();
    let current_agent_name = get_agent_display_name(&config, &agent_id);
    let base_system = agent_files
        .and_then(|f| f.system)
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| {
            format!(
                "You are the team chat agent '{}'. Reply briefly and naturally based on the conversation context.",
                current_agent_name
            )
        });

    let file_action_instruction = if project_path.is_some() {
        "If you need to create project files yourself, append a file action block after your normal reply using this exact format:\n<file-actions>\n{\"actions\":[{\"type\":\"mkdir\",\"path\":\"src/components\"},{\"type\":\"write_file\",\"path\":\"src/index.ts\",\"content\":\"full file content\"}]}\n</file-actions>\nOnly use `mkdir` and `write_file`. Paths must be relative to the bound project directory."
    } else {
        "This room does not yet have a bound project directory, so you must not emit file actions."
    };

    let system_content = format!(
        "{}\n\nImportant: you can read all team history, but you may only speak for yourself as {}. Do not answer on behalf of other teammates and do not produce multi-role replies like 'PM: ... Frontend: ... Backend: ...'.{}\n\n{}{}",
        base_system.trim(),
        current_agent_name,
        project_path
            .as_ref()
            .map(|path| format!("\n\nThe room's bound project directory is: {}. If files need to be created, they should be created there.", path))
            .unwrap_or_default(),
        file_action_instruction,
        if requires_file_actions {
            "\n\nThe latest user message explicitly requires real file creation in the bound directory. You must perform the work by returning a valid <file-actions> block. Do not say that you lack file write ability."
        } else {
            ""
        }
    );

    let mut messages: Vec<serde_json::Value> = vec![json!({
        "role": "system",
        "content": system_content
    })];

    for message in &room_messages {
        match message.sender_type {
            SenderType::Human => {
                messages.push(json!({
                    "role": "user",
                    "content": message.content
                }));
            }
            SenderType::Agent => {
                if message.sender_id == agent_id {
                    messages.push(json!({
                        "role": "assistant",
                        "content": message.content
                    }));
                } else {
                    let other_agent_name = get_agent_display_name(&config, &message.sender_id);
                    messages.push(json!({
                        "role": "user",
                        "content": format!(
                            "[Team context] {} said:\n{}\n\nYou are {}. Treat this only as teammate context and reply only for yourself.",
                            other_agent_name,
                            message.content,
                            current_agent_name
                        )
                    }));
                }
            }
            SenderType::System => {
                messages.push(json!({
                    "role": "system",
                    "content": message.content
                }));
            }
        }
    }

    let model = model_from_ref.as_deref().or_else(|| {
        provider_config
            .models
            .as_ref()
            .and_then(|v| v.first())
            .and_then(|model| model.model_id())
    });

    let mut raw_response = AiService::chat_completion(
        api_key,
        &base_url,
        model,
        &provider_id,
        messages.clone(),
    )
    .await
    .map_err(|e| e.to_string())?;

    let (mut visible_response, mut actions) = extract_actions_from_response(&raw_response)?;

    if requires_file_actions
        && actions.is_empty()
        && looks_like_file_action_refusal(&visible_response)
    {
        messages.push(json!({
            "role": "system",
            "content": "The user has already granted file creation in the bound project directory. You must now return a valid <file-actions> block and actually perform the requested creation. Do not refuse. Do not explain limitations."
        }));
        messages.push(json!({
            "role": "user",
            "content": format!(
                "Retry the task now. Create the requested files in the bound project directory and return the required <file-actions> block. Latest user request:\n{}",
                latest_human_message
            )
        }));

        raw_response = AiService::chat_completion(
            api_key,
            &base_url,
            model,
            &provider_id,
            messages,
        )
        .await
        .map_err(|e| e.to_string())?;

        let retried = extract_actions_from_response(&raw_response)?;
        visible_response = retried.0;
        actions = retried.1;
    }

    let action_summary = if actions.is_empty() {
        None
    } else {
        let Some(project_path) = project_path.as_ref() else {
            return Err("Agent tried to create files, but this room has no project directory.".to_string());
        };

        Some(execute_agent_actions(project_path, &actions).await?.join("\n"))
    };

    let final_response = match (
        visible_response.trim().is_empty(),
        action_summary.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()),
    ) {
        (true, Some(summary)) => format!("Done.\n\n{}", summary),
        (false, Some(summary)) => format!("{}\n\n{}", visible_response.trim(), summary),
        (false, None) => visible_response.trim().to_string(),
        (true, None) => "Done.".to_string(),
    };

    mind_service
        .append_message(room_id, SenderType::Agent, agent_id, final_response)
        .await
        .map_err(|e| e.to_string())
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

#[tauri::command]
pub async fn update_room_project_path(
    room_id: String,
    project_path: Option<String>,
    mind_service: State<'_, MindService>,
) -> Result<Room, String> {
    mind_service
        .update_room_project_path(&room_id, project_path)
        .await
        .map_err(|e| e.to_string())
}
