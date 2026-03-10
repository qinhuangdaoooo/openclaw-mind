use crate::error::{AppError, Result};
use crate::models::skill::{Skill, SkillSource};
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::fs;
use tokio::task;

#[derive(Clone)]
pub struct SkillService {
    skills_dir: PathBuf,
}

impl SkillService {
    pub fn new() -> Self {
        let home = dirs::home_dir().expect("无法获取用户目录");
        let skills_dir = home.join(".openclaw").join("skills");
        
        Self { skills_dir }
    }
    
    pub async fn list_local(&self) -> Result<Vec<Skill>> {
        if !self.skills_dir.exists() {
            return Ok(Vec::new());
        }
        
        let mut skills = Vec::new();
        let mut entries = fs::read_dir(&self.skills_dir).await?;
        
        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_dir() {
                let skill_name = entry.file_name().to_string_lossy().to_string();
                
                // 尝试读取 skill.json 获取详细信息
                let skill_json = entry.path().join("skill.json");
                let skill = if skill_json.exists() {
                    let content = fs::read_to_string(&skill_json).await?;
                    serde_json::from_str(&content).unwrap_or_else(|_| {
                        Skill::new_local(skill_name)
                    })
                } else {
                    Skill::new_local(skill_name)
                };
                
                skills.push(skill);
            }
        }
        
        Ok(skills)
    }
    
    pub async fn search_clawhub(&self, query: &str, limit: usize) -> Result<Vec<Skill>> {
        // TODO: 实现 ClawHub API 调用
        // 这里先返回空列表，后续实现
        Ok(Vec::new())
    }
    
    pub async fn recommend(&self, query: &str, api_key: &str, provider: &str) -> Result<Vec<Skill>> {
        // TODO: 调用 AI Service 进行推荐
        // 这里先返回空列表，后续实现
        Ok(Vec::new())
    }
    
    pub async fn install(&self, workspace_path: &str, skill_slug: &str) -> Result<()> {
        use urlencoding::encode;

        let workspace = self.expand_path(workspace_path);

        // 确保工作区存在
        if !workspace.exists() {
            return Err(format!("工作区不存在: {}", workspace.display()).into());
        }

        let skills_dir = workspace.join("skills");
        let skill_dir = skills_dir.join(skill_slug);

        // 准备临时目录 ~/.openclaw/.tmp
        let home = dirs::home_dir().ok_or_else(|| AppError::Other("无法获取用户目录".to_string()))?;
        let tmp_dir = home.join(".openclaw").join(".tmp");

        fs::create_dir_all(&tmp_dir).await?;
        fs::create_dir_all(&skills_dir).await?;

        // 使用当前时间戳生成临时 zip 文件名，避免重复
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let zip_path = tmp_dir.join(format!("{}-{}.zip", skill_slug, ts));

        // 从 ClawHub 直接下载技能 ZIP，尽量复用已有的登录凭证（readClawHubToken 逻辑参考老项目）
        let download_url = format!(
            "https://clawhub.ai/api/v1/download?slug={}",
            encode(skill_slug)
        );

        let client = reqwest::Client::new();

        // 尝试读取 ClawHub token（由 `npx clawhub login` 写入）
        let token = self.read_clawhub_token();
        let mut req = client
            .get(&download_url)
            .header("User-Agent", "openClaw-mind/0.1.0");

        if let Some(t) = &token {
            req = req.header("Authorization", format!("Bearer {}", t));
        }

        let resp = req
            .send()
            .await
            .map_err(|e| AppError::Network(format!("下载技能失败: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();

            // 与老项目保持一致：429 时给出更友好的提示，引导用户先登录 ClawHub
            if status.as_u16() == 429 {
                return Err(AppError::Network(
                    "请求过于频繁（Rate Limit）。请在本机运行 `npx clawhub login` 登录 ClawHub 账号后再安装。".to_string(),
                ));
            }

            return Err(AppError::Network(format!(
                "下载技能失败: HTTP {} {}",
                status, text
            )));
        }

        let bytes = resp
            .bytes()
            .await
            .map_err(|e| AppError::Network(format!("读取下载内容失败: {}", e)))?;

        // 写入 ZIP 文件
        {
            let mut file = File::create(&zip_path)
                .map_err(|e| AppError::Other(format!("创建临时文件失败: {}", e)))?;
            file.write_all(&bytes)
                .map_err(|e| AppError::Other(format!("写入临时文件失败: {}", e)))?;
        }

        // 如果已存在同名技能目录，先删除
        if skill_dir.exists() {
            fs::remove_dir_all(&skill_dir).await.ok();
        }
        fs::create_dir_all(&skill_dir).await?;

        // 解压 ZIP 到技能目录（使用 zip crate，在阻塞任务中执行）
        let zip_path_clone = zip_path.clone();
        let skill_dir_clone = skill_dir.clone();
        task::spawn_blocking(move || -> Result<()> {
            let file = File::open(&zip_path_clone)
                .map_err(|e| AppError::Other(format!("打开 ZIP 失败: {}", e)))?;
            let mut archive = zip::ZipArchive::new(file)
                .map_err(|e| AppError::Other(format!("解析 ZIP 失败: {}", e)))?;

            for i in 0..archive.len() {
                let mut entry = archive
                    .by_index(i)
                    .map_err(|e| AppError::Other(format!("读取 ZIP 条目失败: {}", e)))?;
                let entry_name = entry.name();
                let out_path = skill_dir_clone.join(entry_name);

                if entry.is_dir() {
                    std::fs::create_dir_all(&out_path)
                        .map_err(|e| AppError::Other(format!("创建目录失败: {}", e)))?;
                } else {
                    if let Some(parent) = out_path.parent() {
                        std::fs::create_dir_all(parent)
                            .map_err(|e| AppError::Other(format!("创建目录失败: {}", e)))?;
                    }
                    let mut outfile = File::create(&out_path)
                        .map_err(|e| AppError::Other(format!("创建文件失败: {}", e)))?;
                    std::io::copy(&mut entry, &mut outfile)
                        .map_err(|e| AppError::Other(format!("写入文件失败: {}", e)))?;
                }
            }

            Ok(())
        })
        .await
        .map_err(|e| AppError::Other(format!("解压任务失败: {}", e)))??;

        // 安装完成后可以选择删除临时 ZIP 文件（忽略错误）
        let _ = std::fs::remove_file(&zip_path);

        Ok(())
    }

    /// 读取 ClawHub 登录 token（兼容 macOS / Windows / Linux）
    fn read_clawhub_token(&self) -> Option<String> {
        use std::env;

        let home = dirs::home_dir()?;
        let mut candidates: Vec<PathBuf> = Vec::new();

        if cfg!(target_os = "macos") {
            candidates.push(
                home.join("Library")
                    .join("Application Support")
                    .join("clawhub")
                    .join("config.json"),
            );
            candidates.push(
                home.join("Library")
                    .join("Application Support")
                    .join("clawdhub")
                    .join("config.json"),
            );
        } else if cfg!(target_os = "windows") {
            let app_data = env::var("APPDATA").unwrap_or_default();
            if !app_data.is_empty() {
                let base = PathBuf::from(app_data);
                candidates.push(base.join("clawhub").join("config.json"));
                candidates.push(base.join("clawdhub").join("config.json"));
            }
        } else {
            // Linux / 其他 *nix
            let xdg = env::var("XDG_CONFIG_HOME").unwrap_or_else(|_| home.join(".config").to_string_lossy().to_string());
            let base = PathBuf::from(xdg);
            candidates.push(base.join("clawhub").join("config.json"));
            candidates.push(base.join("clawdhub").join("config.json"));
        }

        for path in candidates {
            if !path.exists() {
                continue;
            }

            if let Ok(mut file) = File::open(&path) {
                let mut buf = String::new();
                if file.read_to_string(&mut buf).is_ok() {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&buf) {
                        if let Some(token) = json.get("token").and_then(|v| v.as_str()) {
                            if !token.trim().is_empty() {
                                return Some(token.trim().to_string());
                            }
                        }
                    }
                }
            }
        }

        None
    }
    
    /// 列出指定工作区的技能
    pub async fn list_agent_skills(&self, workspace_path: &str) -> Result<Vec<Skill>> {
        let workspace = self.expand_path(workspace_path);
        let skills_dir = workspace.join("skills");
        
        if !skills_dir.exists() {
            return Ok(Vec::new());
        }
        
        let mut skills = Vec::new();
        let mut entries = fs::read_dir(&skills_dir).await?;
        
        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_dir() {
                let skill_name = entry.file_name().to_string_lossy().to_string();
                
                // 尝试读取 SKILL.md 获取描述
                let skill_md = entry.path().join("SKILL.md");
                let description = if skill_md.exists() {
                    let content = fs::read_to_string(&skill_md).await?;
                    // 提取第一段非标题的文本作为描述
                    self.extract_description(&content)
                } else {
                    String::new()
                };
                
                let skill = Skill {
                    name: skill_name,
                    description: Some(description),
                    category: None,
                    source: SkillSource::Local,
                    version: None,
                    author: None,
                };
                
                skills.push(skill);
            }
        }
        
        Ok(skills)
    }
    
    /// 展开路径（处理 ~ 等）
    fn expand_path(&self, path: &str) -> PathBuf {
        if path.starts_with("~/") || path == "~" {
            let home = dirs::home_dir().expect("无法获取用户目录");
            if path == "~" {
                home
            } else {
                home.join(&path[2..])
            }
        } else {
            PathBuf::from(path)
        }
    }
    
    /// 从 Markdown 内容中提取描述
    fn extract_description(&self, content: &str) -> String {
        for line in content.lines() {
            let trimmed = line.trim();
            // 跳过空行、标题、分隔线
            if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with("---") {
                continue;
            }
            // 返回第一个非空非标题行，最多 120 字符
            if trimmed.len() > 120 {
                return format!("{}...", &trimmed[..120]);
            }
            return trimmed.to_string();
        }
        String::new()
    }
    
    /// 列出内置技能（npm 全局包中的技能）
    pub async fn list_builtin(&self) -> Result<Vec<Skill>> {
        // 尝试获取 npm 全局目录
        let output = std::process::Command::new("npm")
            .args(&["root", "-g"])
            .output();
            
        if output.is_err() {
            return Ok(Vec::new());
        }
        
        let npm_root = String::from_utf8_lossy(&output.unwrap().stdout)
            .trim()
            .to_string();
            
        if npm_root.is_empty() {
            return Ok(Vec::new());
        }
        
        let builtin_dir = PathBuf::from(npm_root).join("openclaw").join("skills");
        
        if !builtin_dir.exists() {
            return Ok(Vec::new());
        }
        
        let mut skills = Vec::new();
        let mut entries = fs::read_dir(&builtin_dir).await?;
        
        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_dir() {
                let skill_name = entry.file_name().to_string_lossy().to_string();
                
                // 尝试读取 SKILL.md 获取描述
                let skill_md = entry.path().join("SKILL.md");
                let description = if skill_md.exists() {
                    let content = fs::read_to_string(&skill_md).await?;
                    self.extract_description(&content)
                } else {
                    String::new()
                };
                
                let skill = Skill {
                    name: skill_name,
                    description: Some(description),
                    category: Some("builtin".to_string()),
                    source: SkillSource::Local,
                    version: None,
                    author: None,
                };
                
                skills.push(skill);
            }
        }
        
        Ok(skills)
    }
}
