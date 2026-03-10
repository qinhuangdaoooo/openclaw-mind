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
) -> Result<(), String> {
    use std::process::Stdio;
    use tokio::io::{AsyncBufReadExt, BufReader};
    use tokio::process::Command;
    
    let workspace = std::path::PathBuf::from(shellexpand::tilde(&workspace_path).to_string());
    
    if !workspace.exists() {
        return Err(format!("工作区不存在: {}", workspace.display()));
    }
    
    // 启动后台任务执行安装（Windows 上使用 npx.cmd）
    tauri::async_runtime::spawn(async move {
        let mut cmd = if cfg!(target_os = "windows") {
            Command::new("npx.cmd")
        } else {
            Command::new("npx")
        };

        let mut child = match cmd
            .args(&["-y", "@openclaw/cli", "skill", "add", &skill_slug])
            .current_dir(&workspace)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(c) => c,
            Err(e) => {
                let _ = app.emit("skill-install-log", format!("错误: {}", e));
                let _ = app.emit("skill-install-complete", false);
                return;
            }
        };
        
        // 读取 stdout
        if let Some(stdout) = child.stdout.take() {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app.emit("skill-install-log", line);
            }
        }
        
        // 读取 stderr
        if let Some(stderr) = child.stderr.take() {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app.emit("skill-install-log", format!("stderr: {}", line));
            }
        }
        
        // 等待进程完成
        match child.wait().await {
            Ok(status) => {
                let _ = app.emit("skill-install-complete", status.success());
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
