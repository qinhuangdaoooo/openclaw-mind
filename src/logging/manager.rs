// Log manager implementation
use chrono::Local;

/// Log level for categorizing log messages
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum LogLevel {
    Info,
    Warning,
    Error,
    Success,
}

/// A single log entry
#[derive(Clone, Debug)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: LogLevel,
    pub message: String,
}

/// Log manager for collecting and displaying logs
pub struct LogManager {
    logs: Vec<LogEntry>,
    max_logs: usize,
}

impl LogManager {
    pub fn new(max_logs: usize) -> Self {
        Self {
            logs: Vec::new(),
            max_logs,
        }
    }

    /// Add a log entry
    pub fn log(&mut self, level: LogLevel, message: impl Into<String>) {
        let timestamp = Local::now().format("[%H:%M:%S]").to_string();
        let entry = LogEntry {
            timestamp,
            level,
            message: message.into(),
        };

        self.logs.push(entry);

        // Rotate logs if exceeding max
        if self.logs.len() > self.max_logs {
            self.logs.remove(0);
        }
    }

    /// Get all log entries
    pub fn get_logs(&self) -> &[LogEntry] {
        &self.logs
    }

    /// Clear all logs
    pub fn clear(&mut self) {
        self.logs.clear();
    }

    /// Format logs as display text
    pub fn format_logs(&self) -> String {
        self.logs
            .iter()
            .map(|entry| format!("{} {}", entry.timestamp, entry.message))
            .collect::<Vec<_>>()
            .join("\n")
    }
}

impl Default for LogManager {
    fn default() -> Self {
        Self::new(1000)
    }
}
