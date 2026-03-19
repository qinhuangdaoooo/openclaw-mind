use crate::error::{AppError, Result};
use crate::models::skill::{Skill, SkillSource};
use serde_json::Value;
use std::collections::{BTreeSet, HashSet};
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::fs;
use tokio::task;

#[derive(Clone)]
pub struct SkillService {
    skills_dir: PathBuf,
    openclaw_home: PathBuf,
    config_path: PathBuf,
}

#[derive(Default)]
struct SkillMetadata {
    description: Option<String>,
    category: Option<String>,
    version: Option<String>,
    author: Option<String>,
    tags: Vec<String>,
}

impl SkillService {
    pub fn new() -> Self {
        let home = dirs::home_dir().expect("failed to resolve home directory");
        let openclaw_home = home.join(".openclaw");
        let skills_dir = openclaw_home.join("skills");
        let config_path = openclaw_home.join("openclaw.json");

        Self {
            skills_dir,
            openclaw_home,
            config_path,
        }
    }

    pub async fn list_local(&self) -> Result<Vec<Skill>> {
        self.list_skills_from_directory(
            &self.skills_dir,
            Some("local"),
            Some("user-skill"),
            Some("~/.openclaw/skills"),
            SkillSource::Local,
            Some(true),
        )
        .await
    }

    pub async fn search_clawhub(&self, _query: &str, _limit: usize) -> Result<Vec<Skill>> {
        Ok(Vec::new())
    }

    pub async fn recommend(
        &self,
        _query: &str,
        _api_key: &str,
        _provider: &str,
    ) -> Result<Vec<Skill>> {
        Ok(Vec::new())
    }

    pub async fn install(&self, workspace_path: &str, skill_slug: &str) -> Result<()> {
        use urlencoding::encode;

        let workspace = self.expand_path(workspace_path);
        if !workspace.exists() {
            return Err(format!("workspace does not exist: {}", workspace.display()).into());
        }

        let skills_dir = workspace.join("skills");
        let skill_dir = skills_dir.join(skill_slug);
        let tmp_dir = self.openclaw_home.join(".tmp");

        fs::create_dir_all(&tmp_dir).await?;
        fs::create_dir_all(&skills_dir).await?;

        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let zip_path = tmp_dir.join(format!("{}-{}.zip", skill_slug, ts));

        let download_url = format!(
            "https://clawhub.ai/api/v1/download?slug={}",
            encode(skill_slug)
        );

        let client = reqwest::Client::new();
        let token = self.read_clawhub_token();
        let mut req = client
            .get(&download_url)
            .header("User-Agent", "openClaw-mind/0.1.0");

        if let Some(token) = &token {
            req = req.header("Authorization", format!("Bearer {}", token));
        }

        let resp = req
            .send()
            .await
            .map_err(|e| AppError::Network(format!("failed to download skill: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            if status.as_u16() == 429 {
                return Err(AppError::Network(
                    "rate limited by ClawHub; run `npx clawhub login` and try again".to_string(),
                ));
            }
            return Err(AppError::Network(format!(
                "failed to download skill: HTTP {} {}",
                status, text
            )));
        }

        let bytes = resp
            .bytes()
            .await
            .map_err(|e| AppError::Network(format!("failed to read response body: {}", e)))?;

        {
            let mut file = File::create(&zip_path)
                .map_err(|e| AppError::Other(format!("failed to create temp zip: {}", e)))?;
            file.write_all(&bytes)
                .map_err(|e| AppError::Other(format!("failed to write temp zip: {}", e)))?;
        }

        if skill_dir.exists() {
            fs::remove_dir_all(&skill_dir).await.ok();
        }
        fs::create_dir_all(&skill_dir).await?;

        let zip_path_clone = zip_path.clone();
        let skill_dir_clone = skill_dir.clone();
        task::spawn_blocking(move || -> Result<()> {
            let file = File::open(&zip_path_clone)
                .map_err(|e| AppError::Other(format!("failed to open zip: {}", e)))?;
            let mut archive = zip::ZipArchive::new(file)
                .map_err(|e| AppError::Other(format!("failed to parse zip: {}", e)))?;

            for i in 0..archive.len() {
                let mut entry = archive
                    .by_index(i)
                    .map_err(|e| AppError::Other(format!("failed to read zip entry: {}", e)))?;
                let out_path = skill_dir_clone.join(entry.name());

                if entry.is_dir() {
                    std::fs::create_dir_all(&out_path)
                        .map_err(|e| AppError::Other(format!("failed to create dir: {}", e)))?;
                } else {
                    if let Some(parent) = out_path.parent() {
                        std::fs::create_dir_all(parent).map_err(|e| {
                            AppError::Other(format!("failed to create dir: {}", e))
                        })?;
                    }
                    let mut outfile = File::create(&out_path)
                        .map_err(|e| AppError::Other(format!("failed to create file: {}", e)))?;
                    std::io::copy(&mut entry, &mut outfile)
                        .map_err(|e| AppError::Other(format!("failed to extract file: {}", e)))?;
                }
            }

            Ok(())
        })
        .await
        .map_err(|e| AppError::Other(format!("zip extraction task failed: {}", e)))??;

        let _ = std::fs::remove_file(&zip_path);
        Ok(())
    }

    fn read_clawhub_token(&self) -> Option<String> {
        use std::env;

        let home = dirs::home_dir()?;
        let mut candidates = Vec::new();

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
            let xdg = env::var("XDG_CONFIG_HOME")
                .unwrap_or_else(|_| home.join(".config").to_string_lossy().to_string());
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
                    if let Ok(json) = serde_json::from_str::<Value>(&buf) {
                        if let Some(token) = json.get("token").and_then(|value| value.as_str()) {
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

    pub async fn list_agent_skills(&self, workspace_path: &str) -> Result<Vec<Skill>> {
        let workspace = self.expand_path(workspace_path);
        let skills_dir = workspace.join("skills");
        let origin = format!("workspace {}", workspace.display());

        self.list_skills_from_directory(
            &skills_dir,
            Some("workspace"),
            Some("workspace-skill"),
            Some(origin.as_str()),
            SkillSource::Local,
            Some(true),
        )
        .await
    }

    fn expand_path(&self, path: &str) -> PathBuf {
        if path.starts_with("~/") || path == "~" {
            let home = dirs::home_dir().expect("failed to resolve home directory");
            if path == "~" {
                home
            } else {
                home.join(&path[2..])
            }
        } else {
            PathBuf::from(path)
        }
    }

    fn extract_description(&self, content: &str) -> String {
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with("---") {
                continue;
            }
            if trimmed.len() > 120 {
                return format!("{}...", &trimmed[..120]);
            }
            return trimmed.to_string();
        }
        String::new()
    }

    pub async fn list_builtin(&self) -> Result<Vec<Skill>> {
        let mut skills = Vec::new();

        if let Some(global_openclaw_dir) = self.resolve_global_openclaw_dir() {
            skills.extend(
                self.list_skills_from_directory(
                    &global_openclaw_dir.join("skills"),
                    Some("builtin"),
                    Some("builtin-skill"),
                    Some("global openclaw skills"),
                    SkillSource::Local,
                    Some(true),
                )
                .await?,
            );
            skills.extend(self.list_extension_skills(&global_openclaw_dir.join("extensions")).await?);
        }

        let tool_skills = self.list_local_tools().await?;
        let raw_config = self.read_raw_config().await.unwrap_or(Value::Null);
        let runtime_skills = self.build_runtime_capabilities(&raw_config, &tool_skills);

        skills.extend(runtime_skills);
        skills.extend(tool_skills);
        self.sort_and_dedupe(&mut skills);

        Ok(skills)
    }

    async fn list_skills_from_directory(
        &self,
        dir: &Path,
        category: Option<&str>,
        kind: Option<&str>,
        origin: Option<&str>,
        source: SkillSource,
        enabled: Option<bool>,
    ) -> Result<Vec<Skill>> {
        if !dir.exists() {
            return Ok(Vec::new());
        }

        let mut skills = Vec::new();
        let mut entries = fs::read_dir(dir).await?;

        while let Some(entry) = entries.next_entry().await? {
            if !entry.file_type().await?.is_dir() {
                continue;
            }

            let skill_dir = entry.path();
            let skill_name = entry.file_name().to_string_lossy().to_string();
            let metadata = self.read_skill_metadata(&skill_dir).await;
            let description = metadata
                .description
                .clone()
                .or_else(|| self.fallback_description(&skill_name));
            let tags = self.merge_tags(metadata.tags, self.guess_tags(&skill_name, category));

            skills.push(Skill {
                name: skill_name,
                description,
                category: category
                    .map(|value| value.to_string())
                    .or(metadata.category.clone()),
                source: source.clone(),
                version: metadata.version.clone(),
                author: metadata.author.clone(),
                location: Some(skill_dir.display().to_string()),
                kind: kind.map(|value| value.to_string()),
                origin: origin.map(|value| value.to_string()),
                tags: (!tags.is_empty()).then_some(tags),
                enabled,
            });
        }

        Ok(skills)
    }

    async fn list_extension_skills(&self, extensions_dir: &Path) -> Result<Vec<Skill>> {
        if !extensions_dir.exists() {
            return Ok(Vec::new());
        }

        let mut skills = Vec::new();
        let mut entries = fs::read_dir(extensions_dir).await?;

        while let Some(entry) = entries.next_entry().await? {
            if !entry.file_type().await?.is_dir() {
                continue;
            }

            let extension_name = entry.file_name().to_string_lossy().to_string();
            let extension_skills_dir = entry.path().join("skills");
            let origin = format!("global extension {}", extension_name);

            skills.extend(
                self.list_skills_from_directory(
                    &extension_skills_dir,
                    Some("extension"),
                    Some("extension-skill"),
                    Some(origin.as_str()),
                    SkillSource::Local,
                    Some(true),
                )
                .await?,
            );
        }

        Ok(skills)
    }

    async fn list_local_tools(&self) -> Result<Vec<Skill>> {
        let tools_dir = self.openclaw_home.join("tools");
        if !tools_dir.exists() {
            return Ok(Vec::new());
        }

        let mut skills = Vec::new();
        let mut entries = fs::read_dir(&tools_dir).await?;

        while let Some(entry) = entries.next_entry().await? {
            if !entry.file_type().await?.is_dir() {
                continue;
            }

            let tool_dir = entry.path();
            let tool_name = entry.file_name().to_string_lossy().to_string();
            let metadata = self.read_skill_metadata(&tool_dir).await;
            let description = metadata
                .description
                .clone()
                .or_else(|| self.describe_local_tool(&tool_name));
            let tags = self.merge_tags(metadata.tags, self.guess_tags(&tool_name, Some("tool")));

            skills.push(Skill {
                name: tool_name,
                description,
                category: Some("tool".to_string()),
                source: SkillSource::Local,
                version: metadata.version.clone(),
                author: metadata.author.clone(),
                location: Some(tool_dir.display().to_string()),
                kind: Some("native-tool".to_string()),
                origin: Some("~/.openclaw/tools".to_string()),
                tags: (!tags.is_empty()).then_some(tags),
                enabled: Some(true),
            });
        }

        Ok(skills)
    }

    async fn read_skill_metadata(&self, dir: &Path) -> SkillMetadata {
        let mut metadata = SkillMetadata::default();

        for file_name in ["skill.json", "metadata.json", "_meta.json"] {
            let path = dir.join(file_name);
            if !path.exists() {
                continue;
            }

            if let Ok(content) = fs::read_to_string(&path).await {
                if let Ok(json) = serde_json::from_str::<Value>(&content) {
                    metadata.description = self.value_to_string(json.get("description"));
                    metadata.category = self.value_to_string(json.get("category"));
                    metadata.version = self.value_to_string(json.get("version"));
                    metadata.author = self.value_to_string(json.get("author")).or_else(|| {
                        json.get("author")
                            .and_then(|value| value.get("name"))
                            .and_then(Value::as_str)
                            .map(|value| value.to_string())
                    });
                    if let Some(tags) = json.get("tags").and_then(Value::as_array) {
                        metadata.tags = tags
                            .iter()
                            .filter_map(Value::as_str)
                            .map(|value| value.to_string())
                            .collect();
                    }
                    break;
                }
            }
        }

        if metadata.description.is_none() {
            for file_name in ["SKILL.md", "README.md", "README"] {
                let path = dir.join(file_name);
                if !path.exists() {
                    continue;
                }
                if let Ok(content) = fs::read_to_string(&path).await {
                    let description = self.extract_description(&content);
                    if !description.is_empty() {
                        metadata.description = Some(description);
                        break;
                    }
                }
            }
        }

        metadata
    }

    async fn read_raw_config(&self) -> Result<Value> {
        if !self.config_path.exists() {
            return Ok(Value::Null);
        }

        let content = fs::read_to_string(&self.config_path).await?;
        let content = content.trim_start_matches('\u{feff}');
        Ok(serde_json::from_str(content)?)
    }

    fn build_runtime_capabilities(&self, raw_config: &Value, tool_skills: &[Skill]) -> Vec<Skill> {
        let mut capabilities = Vec::new();
        let location = self.config_path.display().to_string();

        let browser_cfg = raw_config.get("browser");
        let browser_enabled = browser_cfg
            .and_then(|value| value.get("enabled"))
            .and_then(Value::as_bool)
            .unwrap_or(browser_cfg.is_some());
        let default_profile = browser_cfg
            .and_then(|value| value.get("defaultProfile"))
            .and_then(Value::as_str)
            .unwrap_or("default");
        let browser_driver = browser_cfg
            .and_then(|value| value.get("profiles"))
            .and_then(|value| value.get(default_profile))
            .and_then(|value| value.get("driver"))
            .and_then(Value::as_str);

        if browser_cfg.is_some() {
            let mut description = format!(
                "Browser control is configured. Default profile: {}",
                default_profile
            );
            if let Some(driver) = browser_driver {
                description.push_str(&format!(", driver: {}", driver));
            }
            description.push_str(". This supports browser automation and computer-use flows.");

            capabilities.push(self.runtime_skill(
                "browser-control",
                &description,
                "browser-control",
                "openclaw.json:browser",
                vec!["browser", "cdp", "automation", "computer"],
                Some(browser_enabled),
                &location,
            ));
        }

        let exec_cfg = raw_config.get("tools").and_then(|value| value.get("exec"));
        let exec_enabled = exec_cfg.is_some();
        if let Some(exec_cfg) = exec_cfg {
            let host = exec_cfg.get("host").and_then(Value::as_str).unwrap_or("unknown");
            let security = exec_cfg
                .get("security")
                .and_then(Value::as_str)
                .unwrap_or("default");
            let ask = exec_cfg.get("ask").and_then(Value::as_str).unwrap_or("default");

            let description = format!(
                "Command execution is configured. host={}, security={}, ask={}.",
                host, security, ask
            );
            capabilities.push(self.runtime_skill(
                "exec",
                &description,
                "command-execution",
                "openclaw.json:tools.exec",
                vec!["exec", "shell", "command", "computer"],
                Some(true),
                &location,
            ));
        }

        let web_cfg = raw_config.get("tools").and_then(|value| value.get("web"));
        if let Some(fetch_cfg) = web_cfg.and_then(|value| value.get("fetch")) {
            let enabled = fetch_cfg
                .get("enabled")
                .and_then(Value::as_bool)
                .unwrap_or(true);
            let max_chars = fetch_cfg.get("maxChars").and_then(Value::as_u64).unwrap_or(0);
            let timeout_seconds = fetch_cfg
                .get("timeoutSeconds")
                .and_then(Value::as_u64)
                .unwrap_or(0);

            let description = format!(
                "Web fetch is {}. maxChars={}, timeout={}s.",
                if enabled { "enabled" } else { "disabled" },
                max_chars,
                timeout_seconds
            );
            capabilities.push(self.runtime_skill(
                "web-fetch",
                &description,
                "web-fetch",
                "openclaw.json:tools.web.fetch",
                vec!["web", "fetch", "http"],
                Some(enabled),
                &location,
            ));
        }

        if let Some(search_cfg) = web_cfg.and_then(|value| value.get("search")) {
            let enabled = search_cfg
                .get("enabled")
                .and_then(Value::as_bool)
                .unwrap_or(true);
            let description = format!(
                "Web search is {}.",
                if enabled { "enabled" } else { "disabled" }
            );
            capabilities.push(self.runtime_skill(
                "web-search",
                &description,
                "web-search",
                "openclaw.json:tools.web.search",
                vec!["web", "search"],
                Some(enabled),
                &location,
            ));
        }

        if let Some(agent_to_agent_cfg) = raw_config
            .get("tools")
            .and_then(|value| value.get("agentToAgent"))
        {
            let enabled = agent_to_agent_cfg
                .get("enabled")
                .and_then(Value::as_bool)
                .unwrap_or(true);
            let allow_count = agent_to_agent_cfg
                .get("allow")
                .and_then(Value::as_array)
                .map(|items| items.len())
                .unwrap_or(0);
            let description = format!(
                "Agent-to-agent messaging is {}. allow list size={}.",
                if enabled { "enabled" } else { "disabled" },
                allow_count
            );
            capabilities.push(self.runtime_skill(
                "agent-to-agent",
                &description,
                "agent-collaboration",
                "openclaw.json:tools.agentToAgent",
                vec!["agents", "collaboration"],
                Some(enabled),
                &location,
            ));
        }

        let commands_cfg = raw_config.get("commands");
        if let Some(native) = commands_cfg.and_then(|value| value.get("native")) {
            let mode = native.as_str().unwrap_or("unknown");
            capabilities.push(self.runtime_skill(
                "native-commands",
                &format!("Native command mode: {}.", mode),
                "native-commands",
                "openclaw.json:commands.native",
                vec!["commands", "native"],
                Some(!matches!(mode, "off" | "disabled" | "false")),
                &location,
            ));
        }

        if let Some(native_skills) = commands_cfg.and_then(|value| value.get("nativeSkills")) {
            let mode = native_skills.as_str().unwrap_or("unknown");
            capabilities.push(self.runtime_skill(
                "native-skills",
                &format!("Native skill command mode: {}.", mode),
                "native-skills",
                "openclaw.json:commands.nativeSkills",
                vec!["skills", "native"],
                Some(!matches!(mode, "off" | "disabled" | "false")),
                &location,
            ));
        }

        let plugin_allow = raw_config
            .get("plugins")
            .and_then(|value| value.get("allow"))
            .and_then(Value::as_array)
            .map(|items| {
                items.iter()
                    .filter_map(Value::as_str)
                    .map(|value| value.to_string())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let plugin_entries = raw_config
            .get("plugins")
            .and_then(|value| value.get("entries"))
            .and_then(Value::as_object);

        let mut plugin_names = BTreeSet::new();
        for name in &plugin_allow {
            plugin_names.insert(name.clone());
        }
        if let Some(entries) = plugin_entries {
            for name in entries.keys() {
                plugin_names.insert(name.clone());
            }
        }

        for plugin_name in plugin_names {
            let entry = plugin_entries.and_then(|entries| entries.get(&plugin_name));
            let enabled = entry
                .and_then(|value| value.get("enabled"))
                .and_then(Value::as_bool)
                .unwrap_or(plugin_allow.iter().any(|value| value == &plugin_name));
            let mut description = format!(
                "Plugin {} is {}.",
                plugin_name,
                if enabled { "enabled" } else { "configured but disabled" }
            );
            if plugin_name == "skillhub" {
                let primary_cli = entry
                    .and_then(|value| value.get("config"))
                    .and_then(|value| value.get("primaryCli"))
                    .and_then(Value::as_str)
                    .unwrap_or("skillhub");
                let fallback_cli = entry
                    .and_then(|value| value.get("config"))
                    .and_then(|value| value.get("fallbackCli"))
                    .and_then(Value::as_str)
                    .unwrap_or("clawhub");
                description.push_str(&format!(
                    " primaryCli={}, fallbackCli={}.",
                    primary_cli, fallback_cli
                ));
            }

            capabilities.push(self.runtime_skill(
                &format!("plugin.{}", plugin_name),
                &description,
                "plugin",
                "openclaw.json:plugins",
                vec!["plugin", &plugin_name],
                Some(enabled),
                &location,
            ));
        }

        let has_tts = tool_skills.iter().any(|skill| {
            skill.name.to_ascii_lowercase().contains("tts")
                || skill
                    .tags
                    .as_ref()
                    .is_some_and(|tags| tags.iter().any(|tag| tag == "tts"))
        });
        if has_tts {
            capabilities.push(self.runtime_skill(
                "text-to-speech",
                "Detected a local TTS pipeline for voice synthesis.",
                "tts",
                "~/.openclaw/tools",
                vec!["tts", "voice", "audio"],
                Some(true),
                &self.openclaw_home.join("tools").display().to_string(),
            ));
        }

        let has_stt = tool_skills.iter().any(|skill| {
            skill.name.to_ascii_lowercase().contains("whisper")
                || skill
                    .tags
                    .as_ref()
                    .is_some_and(|tags| tags.iter().any(|tag| tag == "stt"))
        });
        if has_stt {
            capabilities.push(self.runtime_skill(
                "speech-to-text",
                "Detected a local speech-to-text pipeline.",
                "stt",
                "~/.openclaw/tools",
                vec!["stt", "speech", "audio"],
                Some(true),
                &self.openclaw_home.join("tools").display().to_string(),
            ));
        }

        if browser_cfg.is_some() || exec_enabled {
            let mut components = Vec::new();
            if browser_cfg.is_some() {
                components.push(format!("browser={}", if browser_enabled { "on" } else { "off" }));
            }
            if exec_enabled {
                components.push("exec=on".to_string());
            }

            capabilities.push(self.runtime_skill(
                "computer-use",
                &format!("Computer-use path is available: {}.", components.join(", ")),
                "computer-use",
                "openclaw runtime",
                vec!["computer", "browser", "exec", "automation"],
                Some(browser_enabled || exec_enabled),
                &location,
            ));
        }

        capabilities
    }

    fn runtime_skill(
        &self,
        name: &str,
        description: &str,
        kind: &str,
        origin: &str,
        tags: Vec<&str>,
        enabled: Option<bool>,
        location: &str,
    ) -> Skill {
        Skill {
            name: name.to_string(),
            description: Some(description.to_string()),
            category: Some("runtime".to_string()),
            source: SkillSource::Local,
            version: None,
            author: None,
            location: Some(location.to_string()),
            kind: Some(kind.to_string()),
            origin: Some(origin.to_string()),
            tags: Some(tags.into_iter().map(|value| value.to_string()).collect()),
            enabled,
        }
    }

    fn sort_and_dedupe(&self, skills: &mut Vec<Skill>) {
        skills.sort_by(|left, right| {
            let left_weight = self.category_weight(left.category.as_deref());
            let right_weight = self.category_weight(right.category.as_deref());
            left_weight
                .cmp(&right_weight)
                .then_with(|| right.enabled.unwrap_or(false).cmp(&left.enabled.unwrap_or(false)))
                .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
        });

        let mut seen = HashSet::new();
        skills.retain(|skill| {
            let key = format!(
                "{}|{}|{}|{}",
                skill.name.to_lowercase(),
                skill.category.clone().unwrap_or_default(),
                skill.kind.clone().unwrap_or_default(),
                skill.origin.clone().unwrap_or_default()
            );
            seen.insert(key)
        });
    }

    fn category_weight(&self, category: Option<&str>) -> u8 {
        match category {
            Some("runtime") => 0,
            Some("tool") => 1,
            Some("builtin") => 2,
            Some("extension") => 3,
            Some("workspace") => 4,
            Some("local") => 5,
            _ => 9,
        }
    }

    fn resolve_global_openclaw_dir(&self) -> Option<PathBuf> {
        let output = std::process::Command::new("npm")
            .args(["root", "-g"])
            .output()
            .ok()?;
        let npm_root = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if npm_root.is_empty() {
            return None;
        }
        Some(PathBuf::from(npm_root).join("openclaw"))
    }

    fn value_to_string(&self, value: Option<&Value>) -> Option<String> {
        match value {
            Some(Value::String(value)) if !value.trim().is_empty() => Some(value.trim().to_string()),
            Some(Value::Number(value)) => Some(value.to_string()),
            Some(Value::Bool(value)) => Some(value.to_string()),
            _ => None,
        }
    }

    fn merge_tags(&self, primary: Vec<String>, secondary: Vec<String>) -> Vec<String> {
        let mut seen = HashSet::new();
        let mut merged = Vec::new();

        for tag in primary.into_iter().chain(secondary) {
            let normalized = tag.trim().to_lowercase();
            if normalized.is_empty() || !seen.insert(normalized.clone()) {
                continue;
            }
            merged.push(normalized);
        }

        merged
    }

    fn guess_tags(&self, name: &str, category: Option<&str>) -> Vec<String> {
        let normalized = name.to_ascii_lowercase();
        let mut tags = Vec::new();

        if normalized.contains("tts") || normalized.contains("voice") {
            tags.extend(["tts", "voice", "audio"].map(str::to_string));
        }
        if normalized.contains("whisper") || normalized.contains("speech") {
            tags.extend(["stt", "speech", "audio"].map(str::to_string));
        }
        if normalized.contains("browser") || normalized.contains("computer") || normalized.contains("clawd") {
            tags.extend(["browser", "computer", "automation"].map(str::to_string));
        }
        if normalized.contains("search") {
            tags.extend(["search", "web"].map(str::to_string));
        }
        if normalized.contains("github") {
            tags.push("github".to_string());
        }
        if normalized.contains("feishu") {
            tags.push("feishu".to_string());
        }
        if matches!(category, Some("builtin")) {
            tags.push("builtin".to_string());
        }

        tags
    }

    fn fallback_description(&self, name: &str) -> Option<String> {
        match name.to_ascii_lowercase().as_str() {
            "sherpa-onnx-tts" => Some("Built-in offline TTS support powered by sherpa-onnx.".to_string()),
            "openai-whisper" => Some("Local Whisper speech recognition support.".to_string()),
            "prose" => Some("Writing and editing support from the Open Prose extension.".to_string()),
            _ => None,
        }
    }

    fn describe_local_tool(&self, tool_name: &str) -> Option<String> {
        match tool_name.to_ascii_lowercase().as_str() {
            "sherpa-onnx-tts" => Some("Local sherpa-onnx runtime and models for offline TTS.".to_string()),
            "openai-whisper" => Some("Local Whisper toolchain for offline speech-to-text.".to_string()),
            _ => Some(format!("Local tool detected at ~/.openclaw/tools/{}.", tool_name)),
        }
    }
}
