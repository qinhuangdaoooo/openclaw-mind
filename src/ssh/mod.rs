// SSH module - handles SSH connections and remote operations
// This module will contain SSH client implementation for remote deployment

pub mod client;

pub use client::{SshAuthMethod, SshClient, SshConfig, CommandOutput};
