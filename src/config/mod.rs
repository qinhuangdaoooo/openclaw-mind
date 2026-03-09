// Configuration module - handles application configuration persistence
// This module manages saving and loading application settings

pub mod persister;

pub use persister::{AppConfig, ConfigPersister, LocalDeployConfig, RemoteDeployConfig};
