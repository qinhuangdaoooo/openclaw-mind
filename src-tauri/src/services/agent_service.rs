use crate::error::Result;
use crate::models::agent::{Agent, AgentFiles};
use crate::models::config::{AgentsConfig, OpenclawConfig};
use std::path::PathBuf;
use tokio::fs;

pub struct AgentService {
    openclaw_home: PathBuf,
}

impl AgentService {
    pub fn new() -> Self {
        let home = dirs::home_dir().expect("无法获取用户目录");
        let openclaw_home = home.join(".openclaw");

        // 调试日志：确认实际使用的配置目录
        println!(
            "[AgentService] Using OPENCLAW_HOME: {}",
            openclaw_home.display()
        );

        Self { openclaw_home }
    }
    
    pub async fn list(&self) -> Result<Vec<Agent>> {
        let config_path = self.openclaw_home.join("openclaw.json");

        println!(
            "[AgentService] Loading agents from config: {}",
            config_path.display()
        );

        if !config_path.exists() {
            println!(
                "[AgentService] Config not found at {}, returning empty list",
                config_path.display()
            );
            return Ok(Vec::new());
        }
        
        let content = fs::read_to_string(&config_path).await?;

        // 处理可能存在的 UTF-8 BOM
        let content = content.trim_start_matches('\u{feff}');

        println!(
            "[AgentService] Config content length: {} bytes",
            content.len()
        );

        let config: OpenclawConfig = serde_json::from_str(content)?;
        
        let agent_configs = config
            .agents
            .and_then(|a| a.list)
            .unwrap_or_default();

        println!(
            "[AgentService] Parsed {} agents from config",
            agent_configs.len()
        );
        
        // 将 AgentConfig 转换为 Agent
        let agents = agent_configs
            .into_iter()
            .map(|ac| Agent {
                id: ac.id,
                name: ac.name,
                workspace: ac.workspace,
                model: ac.model.map(|m| crate::models::agent::AgentModel {
                    primary: m.primary,
                }),
            })
            .collect();
        
        Ok(agents)
    }
    
    pub async fn create(&self, name: &str, workspace: &str, model: Option<&str>) -> Result<Agent> {
        let agent_id = name.to_string(); // 使用 name 作为 ID
        let agent_dir = self.openclaw_home
            .join("agents")
            .join(&agent_id)
            .join("agent");
        
        // 创建 agent 目录
        fs::create_dir_all(&agent_dir).await?;
        
        // 创建默认文件
        let system_md = agent_dir.join("system.md");
        fs::write(&system_md, "# Agent System Prompt\n\n").await?;
        
        let tools_md = agent_dir.join("tools.md");
        fs::write(&tools_md, "# Agent Tools\n\n").await?;
        
        let rules_md = agent_dir.join("rules.md");
        fs::write(&rules_md, "# Agent Rules\n\n").await?;
        
        // 更新配置文件
        let config_path = self.openclaw_home.join("openclaw.json");
        let mut config: OpenclawConfig = if config_path.exists() {
            let content = fs::read_to_string(&config_path).await?;
            serde_json::from_str(&content)?
        } else {
            // 创建空配置
            OpenclawConfig {
                meta: None,
                env: None,
                gateway: None,
                models: None,
                agents: None,
            }
        };
        
        // 添加新 Agent 到配置
        let agents = config.agents.get_or_insert_with(|| AgentsConfig {
            defaults: None,
            list: Some(Vec::new()),
        });
        let list = agents.list.get_or_insert_with(Vec::new);
        
        // 检查是否已存在
        if !list.iter().any(|a| a.id == agent_id) {
            list.push(crate::models::config::AgentConfig {
                id: agent_id.clone(),
                name: Some(name.to_string()),
                workspace: Some(workspace.to_string()),
                model: model.map(|m| crate::models::config::ModelConfig {
                    primary: Some(m.to_string()),
                }),
            });
        }
        
        // 写回配置文件
        let config_json = serde_json::to_string_pretty(&config)?;
        fs::write(&config_path, config_json).await?;
        
        let agent = Agent {
            id: agent_id,
            name: Some(name.to_string()),
            workspace: Some(workspace.to_string()),
            model: model.map(|m| crate::models::agent::AgentModel {
                primary: Some(m.to_string()),
            }),
        };
        
        Ok(agent)
    }
    
    pub async fn read_files(&self, agent_id: &str) -> Result<AgentFiles> {
        let agent_dir = self.openclaw_home
            .join("agents")
            .join(agent_id)
            .join("agent");
        
        let system = self.read_file_optional(&agent_dir.join("system.md")).await?;
        let tools = self.read_file_optional(&agent_dir.join("tools.md")).await?;
        let rules = self.read_file_optional(&agent_dir.join("rules.md")).await?;
        let models = self.read_file_optional(&agent_dir.join("models.json")).await?;
        let auth_profiles = self.read_file_optional(&agent_dir.join("auth-profiles.json")).await?;
        
        Ok(AgentFiles {
            system,
            tools,
            rules,
            models,
            auth_profiles,
        })
    }
    
    pub async fn write_file(&self, agent_id: &str, filename: &str, content: &str) -> Result<()> {
        let agent_dir = self.openclaw_home
            .join("agents")
            .join(agent_id)
            .join("agent");
        
        let file_path = agent_dir.join(filename);
        fs::write(&file_path, content).await?;
        
        Ok(())
    }
    
    pub async fn delete(&self, agent_id: &str) -> Result<()> {
        let agent_dir = self.openclaw_home
            .join("agents")
            .join(agent_id);
        
        if agent_dir.exists() {
            fs::remove_dir_all(&agent_dir).await?;
        }
        
        // 从配置文件中删除
        let config_path = self.openclaw_home.join("openclaw.json");
        if config_path.exists() {
            let content = fs::read_to_string(&config_path).await?;
            let mut config: OpenclawConfig = serde_json::from_str(&content)?;
            
            if let Some(agents) = config.agents.as_mut() {
                if let Some(list) = agents.list.as_mut() {
                    list.retain(|a| a.id != agent_id);
                }
            }
            
            let config_json = serde_json::to_string_pretty(&config)?;
            fs::write(&config_path, config_json).await?;
        }
        
        Ok(())
    }
    
    /// 读取工作区文件（SOUL.md, AGENTS.md, MEMORY.md 等）
    pub async fn read_workspace_file(&self, workspace: &str, filename: &str) -> Result<String> {
        let workspace_path = self.expand_path(workspace);
        let file_path = workspace_path.join(filename);
        
        if !file_path.exists() {
            return Ok(String::new());
        }
        
        let content = fs::read_to_string(&file_path).await?;
        Ok(content)
    }
    
    /// 写入工作区文件
    pub async fn write_workspace_file(&self, workspace: &str, filename: &str, content: &str) -> Result<()> {
        let workspace_path = self.expand_path(workspace);
        
        // 确保工作区目录存在
        if !workspace_path.exists() {
            fs::create_dir_all(&workspace_path).await?;
        }
        
        let file_path = workspace_path.join(filename);
        fs::write(&file_path, content).await?;
        
        Ok(())
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
    
    async fn read_file_optional(&self, path: &PathBuf) -> Result<Option<String>> {
        if !path.exists() {
            return Ok(None);
        }
        
        let content = fs::read_to_string(path).await?;
        Ok(Some(content))
    }
}
