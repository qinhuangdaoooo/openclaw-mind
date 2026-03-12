use crate::models::skill::Skill;
use crate::services::clawhub_service::{ClawHubBrowseResult, ClawHubService};
use tauri::State;

#[tauri::command]
pub async fn search_clawhub_skills(
    query: String,
    limit: usize,
    clawhub_service: State<'_, ClawHubService>,
) -> Result<Vec<Skill>, String> {
    clawhub_service
        .search(&query, limit)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn browse_clawhub_skills(
    cursor: Option<String>,
    sort: Option<String>,
    clawhub_service: State<'_, ClawHubService>,
) -> Result<ClawHubBrowseResult, String> {
    clawhub_service
        .browse(cursor, sort)
        .await
        .map_err(|e| e.to_string())
}
