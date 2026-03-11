use crate::error::{AppError, Result};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Emitter};
use reqwest::header::CONTENT_TYPE;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamChunk {
    pub content: String,
    pub done: bool,
}

fn extract_non_stream_content(body: &str) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(body).ok()?;
    v.get("choices")?
        .get(0)?
        .get("message")?
        .get("content")?
        .as_str()
        .map(|s| s.to_string())
}

#[derive(Debug, Clone)]
struct CacheEntry {
    result: String,
    timestamp: SystemTime,
}

#[derive(Clone)]
pub struct AiService {
    cache: Arc<Mutex<HashMap<String, CacheEntry>>>,
    cache_duration: Duration,
}

impl Default for AiService {
    fn default() -> Self {
        Self::new()
    }
}

impl AiService {
    pub fn new() -> Self {
        Self {
            cache: Arc::new(Mutex::new(HashMap::new())),
            cache_duration: Duration::from_secs(3600), // 1 小时缓存
        }
    }

    /// 检查缓存
    fn get_cached(&self, query: &str) -> Option<String> {
        let cache = self.cache.lock().ok()?;
        let entry = cache.get(query)?;
        
        // 检查是否过期
        if let Ok(elapsed) = entry.timestamp.elapsed() {
            if elapsed < self.cache_duration {
                return Some(entry.result.clone());
            }
        }
        
        None
    }

    /// 保存到缓存
    fn set_cache(&self, query: String, result: String) {
        if let Ok(mut cache) = self.cache.lock() {
            cache.insert(query, CacheEntry {
                result,
                timestamp: SystemTime::now(),
            });
        }
    }

    /// 清理过期缓存
    pub fn cleanup_cache(&self) {
        if let Ok(mut cache) = self.cache.lock() {
            cache.retain(|_, entry| {
                if let Ok(elapsed) = entry.timestamp.elapsed() {
                    elapsed < self.cache_duration
                } else {
                    false
                }
            });
        }
    }

    /// 非流式推荐技能
    pub async fn recommend_skills(
        query: &str,
        api_key: &str,
        provider: &str,
        base_url: &str,
        model: Option<&str>,
    ) -> Result<Vec<String>> {
        let client = reqwest::Client::new();

        let model = model
            .map(|m| m.to_string())
            .unwrap_or_else(|| match provider {
                "deepseek" => "deepseek-chat".to_string(),
                "kimi" => "moonshot-v1-8k".to_string(),
                _ => "gpt-4".to_string(),
            });
        
        let prompt = format!(
            "你是一个技能推荐助手。根据用户的需求推荐合适的技能。\n\n用户需求：{}\n\n请返回 JSON 格式的技能列表，例如：[\"skill1\", \"skill2\"]",
            query
        );
        
        let body = json!({
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "你是一个技能推荐助手，帮助用户找到合适的技能。"
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.7
        });
        
        let response = client
            .post(format!("{}/chat/completions", base_url.trim_end_matches('/')))
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Network(format!("AI API 请求失败: {}", e)))?;
        
        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(AppError::Network(format!(
                "AI API 返回错误 {}: {}",
                status, text
            )));
        }
        
        let result: serde_json::Value = response
            .json()
            .await
            .map_err(|e| AppError::Network(format!("解析 AI 响应失败: {}", e)))?;
        
        // 解析响应
        let content = result
            .get("choices")
            .and_then(|c| c.get(0))
            .and_then(|c| c.get("message"))
            .and_then(|m| m.get("content"))
            .and_then(|c| c.as_str())
            .ok_or_else(|| AppError::Network("AI 响应格式错误".to_string()))?;
        
        // 尝试解析 JSON 结果
        let skills: Vec<String> = serde_json::from_str(content)
            .unwrap_or_else(|_| Vec::new());
        
        Ok(skills)
    }

    /// 非流式对话补全（用于 Mind 房间 Agent 调用）
    pub async fn chat_completion(
        api_key: &str,
        base_url: &str,
        model: Option<&str>,
        provider: &str,
        messages: Vec<serde_json::Value>,
    ) -> Result<String> {
        let client = reqwest::Client::new();
        let model = model
            .map(|m| m.to_string())
            .unwrap_or_else(|| match provider {
                "deepseek" => "deepseek-chat".to_string(),
                "kimi" => "moonshot-v1-8k".to_string(),
                _ => "gpt-4".to_string(),
            });

        let body = json!({
            "model": model,
            "messages": messages,
            "temperature": 0.7
        });

        let response = client
            .post(format!("{}/chat/completions", base_url.trim_end_matches('/')))
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Network(format!("AI API 请求失败: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(AppError::Network(format!(
                "AI API 返回错误 {}: {}",
                status, text
            )));
        }

        let result: serde_json::Value = response
            .json()
            .await
            .map_err(|e| AppError::Network(format!("解析 AI 响应失败: {}", e)))?;

        let content = result
            .get("choices")
            .and_then(|c| c.get(0))
            .and_then(|c| c.get("message"))
            .and_then(|m| m.get("content"))
            .and_then(|c| c.as_str())
            .ok_or_else(|| AppError::Network("AI 响应格式错误".to_string()))?;

        Ok(content.to_string())
    }

    /// 流式推荐技能（带缓存）
    pub async fn recommend_skills_stream(
        &self,
        app: AppHandle,
        query: String,
        api_key: String,
        provider: String,
        base_url: String,
    ) -> Result<()> {
        // 检查缓存
        if let Some(cached_result) = self.get_cached(&query) {
            // 发送缓存的结果
            let _ = app.emit("ai-stream", StreamChunk {
                content: cached_result.clone(),
                done: false,
            });
            let _ = app.emit("ai-stream", StreamChunk {
                content: String::new(),
                done: true,
            });
            return Ok(());
        }

        let client = reqwest::Client::new();
        
        let model = match provider.as_str() {
            "deepseek" => "deepseek-chat",
            "kimi" => "moonshot-v1-8k",
            _ => "gpt-4",
        };
        
        // 改进的 prompt - 更详细的指导和格式要求
        let system_prompt = r#"你是一个专业的 OpenClaw 技能推荐助手。你的任务是根据用户的需求，推荐最合适的技能。

技能类型包括：
- 开发工具：代码生成、测试、调试、重构
- 数据处理：数据分析、清洗、转换、可视化
- 自动化：任务自动化、工作流、脚本
- AI/ML：机器学习、自然语言处理、计算机视觉
- DevOps：部署、监控、日志、CI/CD
- 文档：文档生成、API 文档、技术写作
- 其他：根据具体需求推荐

请仔细分析用户需求，推荐 3-5 个最相关的技能。

返回格式要求：
1. 必须返回有效的 JSON 数组
2. 每个技能包含：name（技能名称）、description（简短描述）、category（分类）
3. 示例格式：
[
  {
    "name": "code-review",
    "description": "自动代码审查和建议",
    "category": "开发工具"
  },
  {
    "name": "test-generator",
    "description": "自动生成单元测试",
    "category": "开发工具"
  }
]"#;
        
        let user_prompt = format!(
            "用户需求：{}\n\n请根据上述需求推荐合适的技能，直接返回 JSON 数组，不要有其他文字说明。",
            query
        );
        
        let body = json!({
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": user_prompt
                }
            ],
            "temperature": 0.7,
            "stream": true
        });
        
        let response = client
            .post(format!("{}/chat/completions", base_url.trim_end_matches('/')))
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Network(format!("AI API 请求失败: {}", e)))?;
        
        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(AppError::Network(format!(
                "AI API 返回错误 {}: {}",
                status, text
            )));
        }
        
        // 处理流式响应
        let mut stream = response.bytes_stream();
        let mut buffer = String::new();
        let mut full_response = String::new();
        
        while let Some(chunk_result) = stream.next().await {
            match chunk_result {
                Ok(chunk) => {
                    let text = String::from_utf8_lossy(&chunk);
                    buffer.push_str(&text);
                    
                    // 处理 SSE 格式的数据
                    for line in buffer.lines() {
                        if line.starts_with("data: ") {
                            let data = &line[6..];
                            
                            if data == "[DONE]" {
                                // 保存到缓存
                                self.set_cache(query.clone(), full_response.clone());
                                
                                // 流结束
                                let _ = app.emit("ai-stream", StreamChunk {
                                    content: String::new(),
                                    done: true,
                                });
                                return Ok(());
                            }
                            
                            // 解析 JSON
                            if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                                if let Some(content) = json
                                    .get("choices")
                                    .and_then(|c| c.get(0))
                                    .and_then(|c| c.get("delta"))
                                    .and_then(|d| d.get("content"))
                                    .and_then(|c| c.as_str())
                                {
                                    // 累积完整响应
                                    full_response.push_str(content);
                                    
                                    // 发送流式数据到前端
                                    let _ = app.emit("ai-stream", StreamChunk {
                                        content: content.to_string(),
                                        done: false,
                                    });
                                }
                            }
                        }
                    }
                    
                    // 清空已处理的行
                    if let Some(last_newline) = buffer.rfind('\n') {
                        buffer = buffer[last_newline + 1..].to_string();
                    }
                }
                Err(e) => {
                    return Err(AppError::Network(format!("读取流失败: {}", e)));
                }
            }
        }
        
        // 保存到缓存
        self.set_cache(query, full_response);
        
        // 流结束
        let _ = app.emit("ai-stream", StreamChunk {
            content: String::new(),
            done: true,
        });
        
        Ok(())
    }

    /// 生成 Agent 配置文件（SOUL.md, AGENTS.md, MEMORY.md）
    pub async fn generate_agent_config(
        &self,
        app: AppHandle,
        description: String,
        api_key: String,
        provider: String,
        base_url: String,
        model: Option<String>,
    ) -> Result<()> {
        let client = reqwest::Client::new();
        
        let model = model.unwrap_or_else(|| match provider.as_str() {
            "deepseek" => "deepseek-chat".to_string(),
            "kimi" => "moonshot-v1-8k".to_string(),
            _ => "gpt-4".to_string(),
        });
        
        let prompt = format!(
            r#"你是一个 AI Agent 配置生成助手。根据用户的描述，生成专业的 Agent 配置文件。

用户描述：{}

请生成以下三个配置文件的内容，使用 JSON 格式返回：

{{
  "soul": "SOUL.md 的内容 - Agent 的核心身份、性格、价值观",
  "agents": "AGENTS.md 的内容 - Agent 的协作规则和其他 Agent 信息",
  "memory": "MEMORY.md 的内容 - Agent 的记忆模板和重要信息"
}}

要求：
1. SOUL.md 应该包含：身份定位、性格特点、专业领域、沟通风格、核心价值观
2. AGENTS.md 应该包含：协作原则、其他 Agent 的角色说明
3. MEMORY.md 应该包含：记忆结构、重要信息模板
4. 内容要专业、详细、实用
5. 使用 Markdown 格式
6. 确保返回有效的 JSON"#,
            description
        );
        
        let body = json!({
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "stream": true,
            "temperature": 0.7,
        });
        
        let base = base_url.trim_end_matches('/').to_string();
        let response = client
            .post(format!("{}/chat/completions", base))
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;
        
        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(AppError::Network(format!(
                "AI API 返回错误 {}: {}",
                status, text
            )));
        }

        // 如果服务端没有返回 SSE，则按非流式 JSON 解析（很多 OpenAI 兼容网关不支持 stream=true）
        let content_type = response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();
        let is_sse = content_type.to_ascii_lowercase().contains("text/event-stream");
        if !is_sse {
            let body_text = response.text().await.unwrap_or_default();
            if let Some(content) = extract_non_stream_content(&body_text) {
                let _ = app.emit("agent-config-complete", content);
                return Ok(());
            }
            return Err(AppError::Network(format!(
                "AI 返回为空或格式不兼容（非 SSE，Content-Type: {}）。请确认 base_url 指向 OpenAI 兼容的 /v1，且返回符合 /chat/completions 的 JSON。",
                if content_type.is_empty() { "(空)" } else { &content_type }
            )));
        }
        
        let mut stream = response.bytes_stream();
        let mut full_content = String::new();
        let mut raw = String::new();
        let mut saw_sse = false;
        
        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result?;
            let text = String::from_utf8_lossy(&chunk);
            raw.push_str(&text);
            
            for line in text.lines() {
                if line.starts_with("data: ") {
                    saw_sse = true;
                    let data = &line[6..];
                    if data == "[DONE]" {
                        let _ = app.emit("agent-config-stream", StreamChunk {
                            content: String::new(),
                            done: true,
                        });
                        break;
                    }
                    
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                        if let Some(content) = json["choices"][0]["delta"]["content"].as_str() {
                            full_content.push_str(content);
                            let _ = app.emit("agent-config-stream", StreamChunk {
                                content: content.to_string(),
                                done: false,
                            });
                        }
                    }
                }
            }
        }
        
        // 如果没有拿到 SSE 内容，尝试按非流式 JSON 解析
        if full_content.trim().is_empty() && !raw.trim().is_empty() {
            if let Some(content) = extract_non_stream_content(&raw) {
                full_content = content;
            }
        }

        // SSE / 非 SSE 都为空：返回错误，前端会显示
        if full_content.trim().is_empty() {
            let hint = if saw_sse {
                "收到 SSE 但未解析到内容"
            } else {
                "未收到 SSE（可能网关不支持 stream=true）"
            };
            return Err(AppError::Network(format!(
                "AI 返回为空（{}）。请检查 base_url 是否为 OpenAI 兼容的 /v1 地址、API Key 是否正确、以及网关是否支持流式。",
                hint
            )));
        }
        
        // 发送完整内容
        let _ = app.emit("agent-config-complete", full_content);
        
        Ok(())
    }
}
