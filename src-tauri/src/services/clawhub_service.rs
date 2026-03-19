use crate::error::Result;
use crate::models::skill::{Skill, SkillSource};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize)]
pub struct ClawHubSearchItem {
    pub slug: String,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    pub name: Option<String>,
    pub score: Option<f64>,
    pub summary: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClawHubBrowseResult {
    pub items: Vec<ClawHubSearchItem>,
    #[serde(rename = "nextCursor")]
    pub next_cursor: Option<String>,
}

pub struct ClawHubService {
    client: reqwest::Client,
    api_base: String,
}

impl ClawHubService {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("OpenClaw/2.0 (Tauri)")
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            api_base: "https://clawhub.ai/api/v1".to_string(),
        }
    }

    /// 搜索 ClawHub 技能
    pub async fn search(&self, query: &str, limit: usize) -> Result<Vec<Skill>> {
        println!("[ClawHub] Searching for: '{}', limit: {}", query, limit);
        
        let url = format!(
            "{}/search?q={}&limit={}",
            self.api_base,
            urlencoding::encode(query),
            limit.min(50)
        );
        
        println!("[ClawHub] Search URL: {}", url);

        // 重试逻辑
        let max_retries = 3;
        for attempt in 0..max_retries {
            match self.client.get(&url).send().await {
                Ok(response) => {
                    if response.status() == 429 {
                        // 速率限制，等待后重试
                        let retry_after = response
                            .headers()
                            .get("Retry-After")
                            .and_then(|v| v.to_str().ok())
                            .and_then(|v| v.parse::<u64>().ok())
                            .unwrap_or(2_u64.pow(attempt as u32));

                        tokio::time::sleep(Duration::from_secs(retry_after)).await;
                        continue;
                    }

                    if !response.status().is_success() {
                        return Err(format!("ClawHub API error: {}", response.status()).into());
                    }

                    let body = response.text().await?;

                    // 检查是否返回 HTML（CDN 错误页面）
                    if body.trim_start().starts_with('<') {
                        return Err("ClawHub returned HTML (CDN error)".into());
                    }

                    // 解析响应
                    let json: serde_json::Value = serde_json::from_str(&body)?;

                    // 尝试不同的响应格式
                    let items = json["results"]
                        .as_array()
                        .or_else(|| json["items"].as_array())
                        .or_else(|| json["data"].as_array())
                        .or_else(|| json.as_array())
                        .ok_or("Invalid response format")?;

                    let skills: Vec<Skill> = items
                        .iter()
                        .filter_map(|item| {
                            let slug = item["slug"].as_str()?;
                            let display_name = item["displayName"]
                                .as_str()
                                .or_else(|| item["name"].as_str())
                                .unwrap_or(slug);
                            let summary = item["summary"].as_str().map(|s| s.to_string());
                            let score = item["score"].as_f64();

                            Some(Skill {
                                name: slug.to_string(),
                                description: summary,
                                category: Some("clawhub".to_string()),
                                source: SkillSource::ClawHub,
                                version: None,
                                author: None,
                                location: None,
                                kind: Some("clawhub-skill".to_string()),
                                origin: Some("clawhub".to_string()),
                                tags: None,
                                enabled: Some(true),
                            })
                        })
                        .take(limit)
                        .collect();

                    return Ok(skills);
                }
                Err(e) => {
                    if attempt < max_retries - 1 {
                        tokio::time::sleep(Duration::from_secs(2_u64.pow(attempt as u32))).await;
                        continue;
                    }
                    return Err(e.into());
                }
            }
        }

        Err("Max retries exceeded".into())
    }

    /// 浏览 ClawHub 技能列表
    pub async fn browse(
        &self,
        cursor: Option<String>,
        sort: Option<String>,
    ) -> Result<ClawHubBrowseResult> {
        let mut url = format!("{}/skills?nonSuspicious=true", self.api_base);

        if let Some(sort_by) = sort {
            url.push_str(&format!("&sort={}", sort_by));
        } else {
            url.push_str("&sort=downloads");
        }

        if let Some(c) = cursor {
            url.push_str(&format!("&cursor={}", urlencoding::encode(&c)));
        }

        // 重试逻辑
        let max_retries = 3;
        for attempt in 0..max_retries {
            match self.client.get(&url).send().await {
                Ok(response) => {
                    if response.status() == 429 {
                        let retry_after = response
                            .headers()
                            .get("Retry-After")
                            .and_then(|v| v.to_str().ok())
                            .and_then(|v| v.parse::<u64>().ok())
                            .unwrap_or(2_u64.pow(attempt as u32));

                        tokio::time::sleep(Duration::from_secs(retry_after)).await;
                        continue;
                    }

                    if !response.status().is_success() {
                        return Err(format!("ClawHub API error: {}", response.status()).into());
                    }

                    let body_text = response.text().await?;
                    println!("[ClawHub] API response body: {}", &body_text[..body_text.len().min(500)]);
                    
                    let result: ClawHubBrowseResult = serde_json::from_str(&body_text)?;
                    println!("[ClawHub] Parsed result: items={}, next_cursor={:?}", result.items.len(), result.next_cursor);
                    return Ok(result);
                }
                Err(e) => {
                    if attempt < max_retries - 1 {
                        tokio::time::sleep(Duration::from_secs(2_u64.pow(attempt as u32))).await;
                        continue;
                    }
                    return Err(e.into());
                }
            }
        }

        Err("Max retries exceeded".into())
    }
}

