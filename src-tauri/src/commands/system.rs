use std::process::Command;

/// 在文件管理器中打开指定路径
#[tauri::command]
pub async fn open_path_in_finder(path: String) -> Result<(), String> {
    let expanded_path = expand_path(&path);

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&expanded_path)
            .spawn()
            .map_err(|e| format!("无法打开文件管理器: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&expanded_path)
            .spawn()
            .map_err(|e| format!("无法打开 Finder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&expanded_path)
            .spawn()
            .map_err(|e| format!("无法打开文件管理器: {}", e))?;
    }

    Ok(())
}

/// 展开路径（处理 ~ 等）
fn expand_path(path: &str) -> String {
    if path.starts_with("~/") || path == "~" {
        if let Some(home) = dirs::home_dir() {
            if path == "~" {
                return home.to_string_lossy().to_string();
            } else {
                return home.join(&path[2..]).to_string_lossy().to_string();
            }
        }
    }
    path.to_string()
}
