use crate::models::skill::{Skill, SkillSource};
use crate::services::ai_service::AiService;
use crate::services::skill_service::SkillService;
use tauri::{AppHandle, Emitter, State};

#[tauri::command]
pub async fn list_local_skills(
    skill_service: State<'_, SkillService>,
) -> Result<Vec<Skill>, String> {
    skill_service.list_local().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_clawhub(
    query: String,
    limit: usize,
    skill_service: State<'_, SkillService>,
) -> Result<Vec<Skill>, String> {
    skill_service
        .search_clawhub(&query, limit)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn recommend_skills(
    query: String,
    api_key: String,
    provider: String,
    base_url: String,
    model: Option<String>,
    ai_service: State<'_, AiService>,
) -> Result<Vec<Skill>, String> {
    let _ = ai_service; // 当前 recommend_skills 是关联函数，这里仅为保持签名一致

    let model_ref = model.as_deref();

    let names: Vec<String> = AiService::recommend_skills(&query, &api_key, &provider, &base_url, model_ref)
        .await
        .map_err(|e| e.to_string())?;

    let skills: Vec<Skill> = names
        .into_iter()
        .map(|name| Skill {
            name,
            description: None,
            category: None,
            source: SkillSource::Recommended,
            version: None,
            author: None,
            location: None,
            kind: None,
            origin: None,
            tags: None,
            enabled: None,
        })
        .collect();

    Ok(skills)
}

#[tauri::command]
pub async fn recommend_skills_stream(
    app: AppHandle,
    query: String,
    api_key: String,
    provider: String,
    base_url: String,
    ai_service: State<'_, AiService>,
) -> Result<(), String> {
    // 在后台任务中运行流式推荐
    let ai_service = ai_service.inner().clone();
    tauri::async_runtime::spawn(async move {
        let _ = ai_service.recommend_skills_stream(app, query, api_key, provider, base_url).await;
    });
    
    Ok(())
}

#[tauri::command]
pub async fn install_skill(
    workspace_path: String,
    skill_slug: String,
    skill_service: State<'_, SkillService>,
) -> Result<(), String> {
    skill_service
        .install(&workspace_path, &skill_slug)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn install_skill_stream(
    app: AppHandle,
    workspace_path: String,
    skill_slug: String,
    skill_service: State<'_, SkillService>,
) -> Result<(), String> {
    // 克隆 service，在后台任务中使用
    let service = skill_service.inner().clone();

    tauri::async_runtime::spawn(async move {
        let _ = app.emit(
            "skill-install-log",
            format!("开始安装技能 `{}` 到工作区 `{}`", skill_slug, workspace_path),
        );

        match service.install(&workspace_path, &skill_slug).await {
            Ok(()) => {
                let _ = app.emit("skill-install-log", "✓ 安装完成".to_string());
                let _ = app.emit("skill-install-complete", true);
            }
            Err(e) => {
                let _ = app.emit("skill-install-log", format!("错误: {}", e));
                let _ = app.emit("skill-install-complete", false);
            }
        }
    });

    Ok(())
}

/// 列出指定工作区的技能
#[tauri::command]
pub async fn list_agent_skills(
    workspace_path: String,
    skill_service: State<'_, SkillService>,
) -> Result<Vec<Skill>, String> {
    skill_service
        .list_agent_skills(&workspace_path)
        .await
        .map_err(|e| e.to_string())
}

/// 列出内置技能
#[tauri::command]
pub async fn list_builtin_skills(
    skill_service: State<'_, SkillService>,
) -> Result<Vec<Skill>, String> {
    skill_service
        .list_builtin()
        .await
        .map_err(|e| e.to_string())
}
