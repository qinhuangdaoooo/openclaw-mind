// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;
mod services;
mod utils;
mod error;

use services::config_service::ConfigService;
use services::agent_service::AgentService;
use services::skill_service::SkillService;
use services::ai_service::AiService;
use services::clawhub_service::ClawHubService;
use services::mind_service::MindService;

fn main() {
    // Initialize services
    let config_service = ConfigService::new();
    let agent_service = AgentService::new();
    let skill_service = SkillService::new();
    let ai_service = AiService::new();
    let clawhub_service = ClawHubService::new();
    let mind_service = MindService::new();

    tauri::Builder::default()
        .manage(config_service)
        .manage(agent_service)
        .manage(skill_service)
        .manage(ai_service)
        .manage(clawhub_service)
        .manage(mind_service)
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // Window commands
            commands::window::minimize_window,
            commands::window::maximize_window,
            commands::window::close_window,
            // Config commands
            commands::config::read_config,
            commands::config::write_config,
            commands::config::validate_config_json,
            commands::config::reload_gateway,
            commands::config::get_providers,
            commands::config::set_default_provider,
            // Agent commands
            commands::agent::list_agents,
            commands::agent::create_agent,
            commands::agent::read_agent_files,
            commands::agent::write_agent_file,
            commands::agent::delete_agent,
            commands::agent::read_workspace_file,
            commands::agent::write_workspace_file,
            commands::agent::generate_agent_config_ai,
            // Skill commands
            commands::skill::list_local_skills,
            commands::skill::search_clawhub,
            commands::skill::recommend_skills,
            commands::skill::recommend_skills_stream,
            commands::skill::install_skill,
            commands::skill::install_skill_stream,
            commands::skill::list_agent_skills,
            commands::skill::list_builtin_skills,
            // Env tool commands
            commands::env_tool::check_env_tool,
            commands::env_tool::install_env_tool,
            commands::env_tool::uninstall_env_tool,
            // SSH commands
            commands::ssh::test_ssh_connection,
            commands::ssh::execute_ssh_command,
            commands::ssh::upload_ssh_file,
            // System commands
            commands::system::open_path_in_finder,
            // ClawHub commands
            commands::clawhub::search_clawhub_skills,
            commands::clawhub::browse_clawhub_skills,
            // Mind commands
            commands::mind::list_rooms,
            commands::mind::create_room,
            commands::mind::list_messages,
            commands::mind::append_message,
            commands::mind::invoke_agent,
            commands::mind::list_tasks,
            commands::mind::create_task,
            commands::mind::update_task_status,
            commands::mind::update_room_agents,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
