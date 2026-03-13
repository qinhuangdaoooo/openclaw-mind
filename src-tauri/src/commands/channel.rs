use crate::models::config::{BindingConfig, BindingPeerConfig, OpenclawConfig};
use crate::models::message::Message;
use crate::models::room::Room;
use crate::services::mind_service::MindService;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelIngestResult {
    pub room: Room,
    pub message: Message,
    pub matched_agent_id: Option<String>,
}

fn binding_matches(
    binding: &BindingConfig,
    channel: &str,
    peer_kind: &str,
    peer_id: &str,
) -> bool {
    if binding.matcher.channel != channel {
        return false;
    }

    match &binding.matcher.peer {
        None => true,
        Some(BindingPeerConfig { kind, id, .. }) => {
            if kind != peer_kind {
                return false;
            }

            if id.trim().is_empty() {
                return true;
            }

            id == peer_id
        }
    }
}

fn match_agent_id(config: &OpenclawConfig, channel: &str, peer_kind: &str, peer_id: &str) -> Option<String> {
    config
        .bindings
        .as_ref()
        .and_then(|bindings| {
            bindings
                .iter()
                .find(|binding| binding_matches(binding, channel, peer_kind, peer_id))
        })
        .map(|binding| binding.agent_id.clone())
        .filter(|agent_id| !agent_id.trim().is_empty())
}

fn build_room_title(channel: &str, title: Option<String>, peer_id: &str) -> String {
    if let Some(value) = title.filter(|value| !value.trim().is_empty()) {
        return value;
    }

    format!("[{}] {}", channel, peer_id)
}

#[tauri::command]
pub async fn ingest_channel_message(
    config: OpenclawConfig,
    channel: String,
    peer_kind: String,
    peer_id: String,
    title: Option<String>,
    sender_id: String,
    content: String,
    mind_service: State<'_, MindService>,
) -> Result<ChannelIngestResult, String> {
    let matched_agent_id = match_agent_id(&config, &channel, &peer_kind, &peer_id);
    let agent_ids = matched_agent_id.clone().into_iter().collect::<Vec<_>>();
    let room_title = build_room_title(&channel, title, &peer_id);
    let external_key = format!("{}:{}:{}", channel, peer_kind, peer_id);

    let (room, message) = mind_service
        .ingest_channel_message(
            external_key,
            room_title,
            channel,
            Some(peer_id),
            agent_ids,
            sender_id,
            content,
        )
        .await
        .map_err(|error| error.to_string())?;

    Ok(ChannelIngestResult {
        room,
        message,
        matched_agent_id,
    })
}
