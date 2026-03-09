// Configuration persistence implementation
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Application configuration
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppConfig {
    pub local_deploy: LocalDeployConfig,
    pub remote_deploy: RemoteDeployConfig,
}

/// Local deployment configuration
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LocalDeployConfig {
    pub openclaw_home: String,
    pub base_url: String,
    pub model: String,
    pub run_smoke_test: bool,
}

/// Remote deployment configuration
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RemoteDeployConfig {
    pub ssh_host: String,
    pub ssh_port: u16,
    pub ssh_username: String,
    pub ssh_auth_method: String, // "password" or "privatekey"
    pub ssh_key_path: String,
    pub remote_openclaw_home: String,
    pub base_url: String,
    pub model: String,
}

/// Configuration persistence manager
pub struct ConfigPersister {
    config_path: PathBuf,
}

impl ConfigPersister {
    pub fn new() -> Result<Self> {
        let config_dir = dirs::home_dir()
            .context("Failed to determine home directory")?
            .join(".openclaw-deployer");
        
        std::fs::create_dir_all(&config_dir)
            .context("Failed to create config directory")?;
        
        let config_path = config_dir.join("config.json");
        
        Ok(Self { config_path })
    }

    /// Load configuration from disk
    pub fn load_config(&self) -> Result<AppConfig> {
        if !self.config_path.exists() {
            return Ok(Self::default_config());
        }

        let content = std::fs::read_to_string(&self.config_path)
            .context("Failed to read config file")?;
        
        if content.trim().is_empty() {
            return Ok(Self::default_config());
        }

        serde_json::from_str(&content)
            .or_else(|_| Ok(Self::default_config()))
    }

    /// Save configuration to disk (excluding passwords)
    pub fn save_config(&self, config: &AppConfig) -> Result<()> {
        let content = serde_json::to_string_pretty(config)
            .context("Failed to serialize config")?;
        
        std::fs::write(&self.config_path, content)
            .context("Failed to write config file")?;
        
        Ok(())
    }

    /// Get default configuration
    pub fn default_config() -> AppConfig {
        let home = dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .display()
            .to_string();

        AppConfig {
            local_deploy: LocalDeployConfig {
                openclaw_home: home.clone(),
                base_url: String::new(),
                model: String::new(),
                run_smoke_test: false,
            },
            remote_deploy: RemoteDeployConfig {
                ssh_host: String::new(),
                ssh_port: 22,
                ssh_username: String::new(),
                ssh_auth_method: "password".to_string(),
                ssh_key_path: String::new(),
                remote_openclaw_home: String::new(),
                base_url: String::new(),
                model: String::new(),
            },
        }
    }
}
