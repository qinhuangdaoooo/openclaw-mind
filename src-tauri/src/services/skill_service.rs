use crate::error::Result;
use crate::models::skill::{Skill, SkillSource};
use std::path::PathBuf;
use tokio::fs;

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
        use std::process::Stdio;
        use tokio::process::Command;
        
        let workspace = self.expand_path(workspace_path);
        
        // 确保工作区存在
        if !workspace.exists() {
            return Err(format!("工作区不存在: {}", workspace.display()).into());
        }
        
        // 构建 npx 命令安装技能（Windows 上使用 npx.cmd）
        let mut cmd = if cfg!(target_os = "windows") {
            Command::new("npx.cmd")
        } else {
            Command::new("npx")
        };

        let output = cmd
            .args(&[
                "-y",
                "@openclaw/cli",
                "skill",
                "add",
                skill_slug,
            ])
            .current_dir(&workspace)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;
        
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("安装失败: {}", stderr).into());
        }
        
        Ok(())
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
