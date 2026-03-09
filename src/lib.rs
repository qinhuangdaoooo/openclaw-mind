use anyhow::{Context, Result, bail};
use chrono::Local;
use reqwest::blocking::Client;
use serde_json::{Map, Value, json};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;
use uuid::Uuid;
use which::which;

// Module declarations
pub mod ssh;
pub mod config;
pub mod logging;
pub mod ui;

pub const PROVIDER_ID: &str = "desktopdeploy";
pub const SMOKE_TEST_MESSAGE: &str = "只回复OK";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ApiKind {
    OpenAiResponses,
    OpenAiCompletions,
}

impl ApiKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::OpenAiResponses => "openai-responses",
            Self::OpenAiCompletions => "openai-completions",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::OpenAiResponses => "OpenAI Responses",
            Self::OpenAiCompletions => "OpenAI Chat Completions",
        }
    }
}

#[derive(Clone, Debug)]
pub struct DeployRequest {
    pub openclaw_home: PathBuf,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}

#[derive(Clone, Debug)]
pub struct ProbeResult {
    pub api_kind: ApiKind,
    pub models_available: bool,
    pub model_found: bool,
    pub notes: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct SmokeTestResult {
    pub success: bool,
    pub text: String,
    pub raw_output: String,
}

#[derive(Clone, Debug)]
pub struct DeployReport {
    pub api_kind: ApiKind,
    pub written_files: Vec<PathBuf>,
    pub backup_files: Vec<PathBuf>,
    pub smoke_test: Option<SmokeTestResult>,
}

pub fn default_openclaw_home() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".openclaw")
}

pub fn normalize_base_url(input: &str) -> String {
    input.trim().trim_end_matches('/').to_string()
}

pub fn validate_request(request: &DeployRequest) -> Result<()> {
    if normalize_base_url(&request.base_url).is_empty() {
        bail!("请求地址不能为空");
    }
    if request.api_key.trim().is_empty() {
        bail!("API Key 不能为空");
    }
    if request.model.trim().is_empty() {
        bail!("模型名不能为空");
    }
    Ok(())
}

pub fn probe_endpoint(request: &DeployRequest) -> Result<ProbeResult> {
    validate_request(request)?;

    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .context("创建 HTTP 客户端失败")?;

    let base_url = normalize_base_url(&request.base_url);
    let mut notes = Vec::new();
    let mut models_available = false;
    let mut model_found = false;

    let models_url = format!("{base_url}/models");
    match client
        .get(&models_url)
        .bearer_auth(request.api_key.trim())
        .send()
    {
        Ok(response) => {
            let status = response.status();
            let body = response.text().unwrap_or_default();
            if status.is_success() {
                models_available = true;
                let ids = parse_model_ids(&body);
                model_found = ids.iter().any(|model_id| model_id == request.model.trim());
                if model_found {
                    notes.push(format!(
                        "GET /models 成功，已找到模型 `{}`",
                        request.model.trim()
                    ));
                } else if ids.is_empty() {
                    notes.push("GET /models 成功，但未解析到模型列表。".to_string());
                } else {
                    notes.push(format!(
                        "GET /models 成功，但模型 `{}` 不在返回列表中。",
                        request.model.trim()
                    ));
                }
            } else {
                notes.push(format!(
                    "GET /models 返回 {}：{}",
                    status.as_u16(),
                    excerpt(&body)
                ));
            }
        }
        Err(error) => notes.push(format!("GET /models 请求失败：{error}")),
    }

    let responses_url = format!("{base_url}/responses");
    let responses_body = build_responses_probe_body(request.model.trim());
    match client
        .post(&responses_url)
        .bearer_auth(request.api_key.trim())
        .json(&responses_body)
        .send()
    {
        Ok(response) => {
            let status = response.status();
            let body = response.text().unwrap_or_default();
            if status.is_success() {
                notes.push("POST /responses 成功，自动识别为 openai-responses。".to_string());
                return Ok(ProbeResult {
                    api_kind: ApiKind::OpenAiResponses,
                    models_available,
                    model_found,
                    notes,
                });
            }
            notes.push(format!(
                "POST /responses 返回 {}：{}",
                status.as_u16(),
                excerpt(&body)
            ));
        }
        Err(error) => notes.push(format!("POST /responses 请求失败：{error}")),
    }

    let chat_url = format!("{base_url}/chat/completions");
    let chat_body = build_chat_probe_body(request.model.trim());
    match client
        .post(&chat_url)
        .bearer_auth(request.api_key.trim())
        .json(&chat_body)
        .send()
    {
        Ok(response) => {
            let status = response.status();
            let body = response.text().unwrap_or_default();
            if status.is_success() {
                notes.push(
                    "POST /chat/completions 成功，自动识别为 openai-completions。".to_string(),
                );
                return Ok(ProbeResult {
                    api_kind: ApiKind::OpenAiCompletions,
                    models_available,
                    model_found,
                    notes,
                });
            }
            notes.push(format!(
                "POST /chat/completions 返回 {}：{}",
                status.as_u16(),
                excerpt(&body)
            ));
        }
        Err(error) => notes.push(format!("POST /chat/completions 请求失败：{error}")),
    }

    bail!("接口探测失败：\n{}", notes.join("\n"))
}

pub fn deploy_configuration(
    request: &DeployRequest,
    api_kind: ApiKind,
    run_smoke_test: bool,
) -> Result<DeployReport> {
    validate_request(request)?;

    let openclaw_json_path = request.openclaw_home.join("openclaw.json");
    let main_agent_dir = request
        .openclaw_home
        .join("agents")
        .join("main")
        .join("agent");
    let models_path = main_agent_dir.join("models.json");
    let auth_profiles_path = main_agent_dir.join("auth-profiles.json");

    let openclaw_value =
        upsert_openclaw_json(read_optional_json(&openclaw_json_path)?, request, api_kind);
    let models_value = upsert_agent_models(read_optional_json(&models_path)?, request, api_kind);
    let auth_profiles_value =
        upsert_auth_profiles(read_optional_json(&auth_profiles_path)?, request);

    let mut written_files = Vec::new();
    let mut backup_files = Vec::new();

    write_json_with_backup(&openclaw_json_path, &openclaw_value, &mut backup_files)?;
    written_files.push(openclaw_json_path);

    write_json_with_backup(&models_path, &models_value, &mut backup_files)?;
    written_files.push(models_path);

    write_json_with_backup(&auth_profiles_path, &auth_profiles_value, &mut backup_files)?;
    written_files.push(auth_profiles_path);

    let smoke_test = if run_smoke_test {
        Some(run_openclaw_smoke_test(request)?)
    } else {
        None
    };

    Ok(DeployReport {
        api_kind,
        written_files,
        backup_files,
        smoke_test,
    })
}

pub fn build_responses_probe_body(model: &str) -> Value {
    json!({
        "model": model,
        "input": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": "Reply OK only"
                    }
                ]
            }
        ]
    })
}

pub fn build_chat_probe_body(model: &str) -> Value {
    json!({
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": "Reply OK only"
            }
        ]
    })
}

pub fn upsert_openclaw_json(
    existing: Option<Value>,
    request: &DeployRequest,
    api_kind: ApiKind,
) -> Value {
    let mut root = existing.unwrap_or_else(|| json!({}));
    let base_url = normalize_base_url(&request.base_url);
    let provider_model = format!("{PROVIDER_ID}/{}", request.model.trim());

    *ensure_path(&mut root, &["models", "mode"]) = json!("merge");
    *ensure_path(&mut root, &["models", "providers", PROVIDER_ID]) = json!({
        "baseUrl": base_url,
        "apiKey": request.api_key.trim(),
        "api": api_kind.as_str(),
        "models": [
            {
                "id": request.model.trim(),
                "name": request.model.trim(),
                "api": api_kind.as_str(),
                "reasoning": false,
                "input": ["text"],
                "contextWindow": 1_000_000,
                "maxTokens": 65_536
            }
        ]
    });
    *ensure_path(&mut root, &["agents", "defaults", "model", "primary"]) =
        json!(provider_model.clone());

    let defaults_models = ensure_object(ensure_path(&mut root, &["agents", "defaults", "models"]));
    defaults_models.insert(provider_model.clone(), json!({}));

    let agents_list = ensure_path(&mut root, &["agents", "list"]);
    if !agents_list.is_array() {
        *agents_list = json!([{ "id": "main" }]);
    } else if let Some(list) = agents_list.as_array_mut() {
        let has_main = list
            .iter()
            .any(|entry| entry.get("id").and_then(Value::as_str) == Some("main"));
        if !has_main {
            list.push(json!({ "id": "main" }));
        }
    }

    let gateway = ensure_object(ensure_path(&mut root, &["gateway"]));
    gateway
        .entry("mode".to_string())
        .or_insert_with(|| json!("local"));

    *ensure_path(&mut root, &["meta", "lastTouchedAt"]) = json!(Local::now().to_rfc3339());
    root
}

pub fn upsert_agent_models(
    existing: Option<Value>,
    request: &DeployRequest,
    api_kind: ApiKind,
) -> Value {
    let mut root = existing.unwrap_or_else(|| json!({}));
    let base_url = normalize_base_url(&request.base_url);

    *ensure_path(&mut root, &["providers", PROVIDER_ID]) = json!({
        "baseUrl": base_url,
        "apiKey": request.api_key.trim(),
        "api": api_kind.as_str(),
        "models": [
            {
                "id": request.model.trim(),
                "name": request.model.trim(),
                "api": api_kind.as_str(),
                "reasoning": false,
                "input": ["text"],
                "contextWindow": 1_000_000,
                "maxTokens": 65_536,
                "cost": {
                    "input": 0,
                    "output": 0,
                    "cacheRead": 0,
                    "cacheWrite": 0
                }
            }
        ]
    });

    root
}

pub fn upsert_auth_profiles(existing: Option<Value>, request: &DeployRequest) -> Value {
    let mut root = existing.unwrap_or_else(|| json!({}));
    let profile_id = format!("{PROVIDER_ID}:manual");

    *ensure_path(&mut root, &["version"]) = json!(1);

    let profiles = ensure_object(ensure_path(&mut root, &["profiles"]));
    profiles.insert(
        profile_id.clone(),
        json!({
            "type": "token",
            "provider": PROVIDER_ID,
            "token": request.api_key.trim()
        }),
    );

    let last_good = ensure_object(ensure_path(&mut root, &["lastGood"]));
    last_good.insert(PROVIDER_ID.to_string(), json!(profile_id.clone()));

    let usage_stats = ensure_object(ensure_path(&mut root, &["usageStats"]));
    usage_stats
        .entry(profile_id)
        .or_insert_with(|| json!({ "errorCount": 0 }));

    root
}

pub fn run_openclaw_smoke_test(request: &DeployRequest) -> Result<SmokeTestResult> {
    let command_path = find_openclaw_command()?;
    let session_id = format!("desktop-deployer-{}", Uuid::new_v4());
    let output = Command::new(command_path)
        .arg("agent")
        .arg("--local")
        .arg("--agent")
        .arg("main")
        .arg("--json")
        .arg("--session-id")
        .arg(session_id)
        .arg("--message")
        .arg(SMOKE_TEST_MESSAGE)
        .env("OPENCLAW_HOME", &request.openclaw_home)
        .output()
        .context("执行 openclaw 冒烟测试失败")?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = if stderr.trim().is_empty() {
        stdout.clone()
    } else {
        format!("{stdout}\n{stderr}")
    };

    let text = extract_first_payload_text(&combined).unwrap_or_default();
    let success = output.status.success() && text.trim() == "OK";

    Ok(SmokeTestResult {
        success,
        text,
        raw_output: combined,
    })
}

pub fn extract_first_payload_text(output: &str) -> Result<String> {
    let json_text = extract_first_json_block(output).context("未在输出中找到 JSON")?;
    let value: Value = serde_json::from_str(&json_text).context("解析 OpenClaw JSON 输出失败")?;
    value
        .get("payloads")
        .and_then(Value::as_array)
        .and_then(|payloads| payloads.first())
        .and_then(|payload| payload.get("text"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .context("JSON 中未找到 payloads[0].text")
}

pub fn extract_first_json_block(output: &str) -> Option<String> {
    let start = output.find('{')?;
    let text = &output[start..];
    let mut depth = 0usize;
    let mut in_string = false;
    let mut escaped = false;

    for (index, character) in text.char_indices() {
        if in_string {
            if escaped {
                escaped = false;
                continue;
            }
            if character == '\\' {
                escaped = true;
                continue;
            }
            if character == '"' {
                in_string = false;
            }
            continue;
        }

        match character {
            '"' => in_string = true,
            '{' => depth += 1,
            '}' => {
                depth = depth.saturating_sub(1);
                if depth == 0 {
                    return Some(text[..=index].to_string());
                }
            }
            _ => {}
        }
    }

    None
}

fn read_optional_json(path: &Path) -> Result<Option<Value>> {
    if !path.exists() {
        return Ok(None);
    }
    let content =
        fs::read_to_string(path).with_context(|| format!("读取文件失败: {}", path.display()))?;
    if content.trim().is_empty() {
        return Ok(Some(json!({})));
    }
    let value = serde_json::from_str(&content)
        .with_context(|| format!("JSON 解析失败: {}", path.display()))?;
    Ok(Some(value))
}

fn write_json_with_backup(path: &Path, value: &Value, backups: &mut Vec<PathBuf>) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("创建目录失败: {}", parent.display()))?;
    }

    if path.exists() {
        let backup = build_backup_path(path);
        fs::copy(path, &backup)
            .with_context(|| format!("创建备份失败: {} -> {}", path.display(), backup.display()))?;
        backups.push(backup);
    }

    let content = serde_json::to_string_pretty(value).context("序列化 JSON 失败")?;
    fs::write(path, format!("{content}\n"))
        .with_context(|| format!("写入文件失败: {}", path.display()))?;
    Ok(())
}

fn build_backup_path(path: &Path) -> PathBuf {
    let file_name = path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "config.json".to_string());
    let backup_name = format!("{file_name}.bak-{}", Local::now().format("%Y%m%d-%H%M%S"));
    path.with_file_name(backup_name)
}

fn ensure_object(value: &mut Value) -> &mut Map<String, Value> {
    if !value.is_object() {
        *value = Value::Object(Map::new());
    }
    value.as_object_mut().expect("value must be object")
}

fn ensure_path<'a>(value: &'a mut Value, path: &[&str]) -> &'a mut Value {
    let mut current = value;
    for key in path {
        let object = ensure_object(current);
        current = object.entry((*key).to_string()).or_insert(Value::Null);
    }
    current
}

fn parse_model_ids(body: &str) -> Vec<String> {
    let value: Value = match serde_json::from_str(body) {
        Ok(value) => value,
        Err(_) => return Vec::new(),
    };

    value
        .get("data")
        .and_then(Value::as_array)
        .map(|models| {
            models
                .iter()
                .filter_map(|entry| entry.get("id").and_then(Value::as_str))
                .map(ToOwned::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

fn excerpt(body: &str) -> String {
    let trimmed = body.trim();
    let mut excerpt = trimmed.chars().take(240).collect::<String>();
    if trimmed.chars().count() > 240 {
        excerpt.push_str("...");
    }
    excerpt
}

fn find_openclaw_command() -> Result<PathBuf> {
    if let Ok(path) = which("openclaw.cmd") {
        return Ok(path);
    }
    if let Ok(path) = which("openclaw") {
        return Ok(path);
    }

    let home = dirs::home_dir().context("无法确定用户目录")?;
    let candidate = home
        .join("AppData")
        .join("Roaming")
        .join("npm")
        .join("openclaw.cmd");
    if candidate.exists() {
        return Ok(candidate);
    }

    bail!("未找到 openclaw/openclaw.cmd，请先安装 OpenClaw CLI")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_request() -> DeployRequest {
        DeployRequest {
            openclaw_home: PathBuf::from(r"C:\Users\tester\.openclaw"),
            base_url: "https://example.com/v1/".to_string(),
            api_key: "sk-test".to_string(),
            model: "gpt-5.4".to_string(),
        }
    }

    #[test]
    fn normalize_base_url_removes_trailing_slash() {
        assert_eq!(
            normalize_base_url(" https://example.com/v1/ "),
            "https://example.com/v1"
        );
    }

    #[test]
    fn responses_probe_body_uses_input_list() {
        let body = build_responses_probe_body("gpt-5.4");
        assert_eq!(body["model"], "gpt-5.4");
        assert_eq!(body["input"][0]["content"][0]["type"], "input_text");
    }

    #[test]
    fn openclaw_json_upsert_sets_provider_and_default_model() {
        let value = upsert_openclaw_json(None, &sample_request(), ApiKind::OpenAiResponses);
        assert_eq!(
            value["models"]["providers"][PROVIDER_ID]["baseUrl"],
            "https://example.com/v1"
        );
        assert_eq!(
            value["models"]["providers"][PROVIDER_ID]["api"],
            "openai-responses"
        );
        assert_eq!(
            value["agents"]["defaults"]["model"]["primary"],
            "desktopdeploy/gpt-5.4"
        );
    }

    #[test]
    fn auth_profiles_upsert_updates_last_good() {
        let value = upsert_auth_profiles(None, &sample_request());
        assert_eq!(
            value["profiles"]["desktopdeploy:manual"]["token"],
            "sk-test"
        );
        assert_eq!(value["lastGood"][PROVIDER_ID], "desktopdeploy:manual");
    }

    #[test]
    fn extracts_payload_text_from_noisy_output() {
        let output = "[plugins] hello\n{\"payloads\":[{\"text\":\"OK\"}],\"meta\":{}}";
        let text = extract_first_payload_text(output).expect("text should parse");
        assert_eq!(text, "OK");
    }

    #[test]
    fn parses_model_ids_from_models_response() {
        let ids = parse_model_ids(r#"{"data":[{"id":"gpt-5.4"},{"id":"gpt-5"}]}"#);
        assert_eq!(ids, vec!["gpt-5.4".to_string(), "gpt-5".to_string()]);
    }
}
