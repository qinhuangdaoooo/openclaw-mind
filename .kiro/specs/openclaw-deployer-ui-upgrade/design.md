# Design Document: OpenClaw Deployer UI Upgrade

## Overview

本设计文档描述了 OpenClaw Desktop Deployer 的 UI 升级和远程部署功能的技术实现方案。该升级将保留所有现有的本地部署功能，同时引入现代化的深色主题界面和基于 SSH 的远程部署能力。

核心目标：
- 保持现有本地部署功能完全兼容
- 实现现代化的深色主题 UI，参考 OpenClaw 官方风格
- 新增远程 SSH 部署功能
- 提供清晰的操作反馈和日志系统

技术栈：
- UI 框架：eframe/egui (保持不变)
- SSH 库：ssh2-rs (Rust 的 libssh2 绑定)
- 配置持久化：serde_json
- 现有依赖：保持不变

## Architecture

### 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    DeployerApp (Main)                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │           UI Layer (egui)                         │  │
│  │  ┌──────────────┐      ┌──────────────┐          │  │
│  │  │ Local Deploy │      │ Remote Deploy│          │  │
│  │  │     Tab      │      │     Tab      │          │  │
│  │  └──────────────┘      └──────────────┘          │  │
│  └───────────────────────────────────────────────────┘  │
│                          │                              │
│  ┌───────────────────────┴───────────────────────────┐  │
│  │              Business Logic Layer                 │  │
│  │  ┌──────────────┐      ┌──────────────┐          │  │
│  │  │LocalDeployment│      │RemoteDeployment│        │  │
│  │  │   Module     │      │    Module    │          │  │
│  │  └──────────────┘      └──────────────┘          │  │
│  └───────────────────────────────────────────────────┘  │
│                          │                              │
│  ┌───────────────────────┴───────────────────────────┐  │
│  │              Infrastructure Layer                 │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │  │
│  │  │SSH Client│  │Detection │  │Config    │        │  │
│  │  │          │  │Module    │  │Persister │        │  │
│  │  └──────────┘  └──────────┘  └──────────┘        │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 模块职责

1. **UI Layer**: 负责渲染界面、处理用户交互、管理标签页切换
2. **Business Logic Layer**: 实现本地和远程部署的核心业务逻辑
3. **Infrastructure Layer**: 提供底层服务（SSH 连接、检测、配置持久化）

### 数据流

```
用户输入 → UI Layer → Business Logic → Infrastructure → 外部系统
                ↓                                          ↓
            UI 更新 ← 状态/日志 ← 操作结果 ← 响应
```

## Components and Interfaces

### 1. UI Theme System

**职责**: 管理应用程序的视觉主题，提供一致的颜色、字体和样式定义。

**接口**:
```rust
// 主题颜色定义
pub struct ThemeColors {
    pub background: Color32,
    pub surface: Color32,
    pub surface_soft: Color32,
    pub border: Color32,
    pub text_primary: Color32,
    pub text_muted: Color32,
    pub primary: Color32,
    pub success: Color32,
    pub warning: Color32,
    pub danger: Color32,
}

// 应用主题配置
pub fn configure_theme(ctx: &egui::Context);

// 获取当前主题颜色
pub fn get_theme_colors() -> ThemeColors;
```

**实现说明**:
- 深色背景：RGB(9, 12, 20)
- 卡片表面：RGB(16, 22, 34)
- 主色调：RGB(64, 132, 255)
- 成功色：RGB(52, 199, 132)
- 警告色：RGB(241, 183, 76)
- 错误色：RGB(234, 96, 96)

### 2. Tab Manager

**职责**: 管理本地部署和远程部署标签页的切换和状态。

**接口**:
```rust
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum DeployTab {
    Local,
    Remote,
}

pub struct TabManager {
    active_tab: DeployTab,
}

impl TabManager {
    pub fn new() -> Self;
    pub fn active_tab(&self) -> DeployTab;
    pub fn set_active_tab(&mut self, tab: DeployTab);
    pub fn render_tabs(&mut self, ui: &mut egui::Ui);
}
```

### 3. SSH Client

**职责**: 管理 SSH 连接、执行远程命令、传输文件。

**接口**:
```rust
#[derive(Clone, Debug)]
pub enum SshAuthMethod {
    Password(String),
    PrivateKey { path: PathBuf, passphrase: Option<String> },
}

#[derive(Clone, Debug)]
pub struct SshConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth: SshAuthMethod,
}

pub struct SshClient {
    config: SshConfig,
    session: Option<Session>,
}

impl SshClient {
    pub fn new(config: SshConfig) -> Self;
    
    // 建立 SSH 连接
    pub fn connect(&mut self) -> Result<()>;
    
    // 断开连接
    pub fn disconnect(&mut self);
    
    // 执行远程命令并返回输出
    pub fn execute_command(&mut self, command: &str) -> Result<CommandOutput>;
    
    // 上传文件到远程服务器
    pub fn upload_file(&mut self, local_content: &str, remote_path: &str) -> Result<()>;
    
    // 检查远程文件是否存在
    pub fn file_exists(&mut self, remote_path: &str) -> Result<bool>;
    
    // 重命名远程文件（用于备份）
    pub fn rename_file(&mut self, old_path: &str, new_path: &str) -> Result<()>;
    
    // 检查连接状态
    pub fn is_connected(&self) -> bool;
}

pub struct CommandOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}
```

**实现说明**:
- 使用 `ssh2` crate 实现 SSH 功能
- 支持密码和私钥两种认证方式
- 提供命令执行和文件传输能力
- 错误处理：连接超时、认证失败、命令执行失败

### 4. Remote Detection Module

**职责**: 检测远程服务器上的 OpenClaw CLI 安装状态和 API 端点可用性。

**接口**:
```rust
pub struct RemoteDetectionModule {
    ssh_client: SshClient,
}

impl RemoteDetectionModule {
    pub fn new(ssh_client: SshClient) -> Self;
    
    // 检测远程 OpenClaw CLI
    pub fn detect_openclaw_cli(&mut self) -> Result<CliDetectionResult>;
    
    // 从本地检测远程 API 端点（复用现有 probe_endpoint）
    pub fn detect_remote_api(&self, request: &DeployRequest) -> Result<ProbeResult>;
}

pub struct CliDetectionResult {
    pub installed: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}
```

**实现说明**:
- CLI 检测：执行 `which openclaw` 或 `where openclaw`
- 版本检测：执行 `openclaw --version`
- API 检测：复用现有的 `probe_endpoint` 函数（从本地测试远程 API）

### 5. Remote Config Uploader

**职责**: 将配置文件上传到远程服务器，处理备份和覆盖逻辑。

**接口**:
```rust
pub struct RemoteConfigUploader {
    ssh_client: SshClient,
}

impl RemoteConfigUploader {
    pub fn new(ssh_client: SshClient) -> Self;
    
    // 上传配置文件到远程服务器
    pub fn upload_configs(
        &mut self,
        request: &DeployRequest,
        api_kind: ApiKind,
    ) -> Result<RemoteDeployReport>;
    
    // 创建远程备份
    fn create_remote_backup(&mut self, remote_path: &str) -> Result<Option<String>>;
}

pub struct RemoteDeployReport {
    pub api_kind: ApiKind,
    pub uploaded_files: Vec<String>,
    pub backup_files: Vec<String>,
}
```

**实现说明**:
- 生成配置内容：复用现有的 `upsert_*` 函数
- 上传前检查远程文件是否存在
- 如果存在，创建带时间戳的备份
- 使用 SFTP 上传配置文件

### 6. Remote Gateway Manager

**职责**: 管理远程 OpenClaw Gateway 的启动和停止。

**接口**:
```rust
pub struct RemoteGatewayManager {
    ssh_client: SshClient,
    gateway_running: bool,
}

impl RemoteGatewayManager {
    pub fn new(ssh_client: SshClient) -> Self;
    
    // 启动远程 Gateway
    pub fn start_gateway(&mut self, openclaw_home: &str) -> Result<()>;
    
    // 停止远程 Gateway
    pub fn stop_gateway(&mut self) -> Result<()>;
    
    // 检查 Gateway 运行状态
    pub fn is_running(&self) -> bool;
}
```

**实现说明**:
- 启动：执行 `OPENCLAW_HOME=<path> nohup openclaw gateway --allow-unconfigured --token <token> > gateway.log 2>&1 &`
- 停止：查找进程并发送 SIGTERM
- 状态检查：通过 `ps` 命令检查进程是否存在

### 7. Config Persister

**职责**: 持久化应用程序配置到本地文件系统。

**接口**:
```rust
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppConfig {
    pub local_deploy: LocalDeployConfig,
    pub remote_deploy: RemoteDeployConfig,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LocalDeployConfig {
    pub openclaw_home: String,
    pub base_url: String,
    pub model: String,
    pub run_smoke_test: bool,
}

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

pub struct ConfigPersister {
    config_path: PathBuf,
}

impl ConfigPersister {
    pub fn new() -> Result<Self>;
    
    // 加载配置
    pub fn load_config(&self) -> Result<AppConfig>;
    
    // 保存配置（不包括密码）
    pub fn save_config(&self, config: &AppConfig) -> Result<()>;
    
    // 获取默认配置
    pub fn default_config() -> AppConfig;
}
```

**实现说明**:
- 配置文件路径：`~/.openclaw-deployer/config.json`
- 不保存密码和私钥内容，只保存路径
- 如果配置文件不存在或损坏，使用默认值

### 8. Log Manager

**职责**: 管理应用程序日志的收集、格式化和显示。

**接口**:
```rust
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum LogLevel {
    Info,
    Warning,
    Error,
    Success,
}

pub struct LogEntry {
    pub timestamp: String,
    pub level: LogLevel,
    pub message: String,
}

pub struct LogManager {
    logs: Vec<LogEntry>,
    max_logs: usize,
}

impl LogManager {
    pub fn new(max_logs: usize) -> Self;
    
    // 添加日志条目
    pub fn log(&mut self, level: LogLevel, message: impl Into<String>);
    
    // 获取所有日志
    pub fn get_logs(&self) -> &[LogEntry];
    
    // 清空日志
    pub fn clear(&mut self);
    
    // 格式化日志为显示文本
    pub fn format_logs(&self) -> String;
}
```

**实现说明**:
- 最大日志条目数：1000（防止内存溢出）
- 时间戳格式：`[HH:MM:SS]`
- 颜色编码：Info(白色)、Warning(黄色)、Error(红色)、Success(绿色)

### 9. Local Deployment Module

**职责**: 封装现有的本地部署逻辑，保持向后兼容。

**接口**:
```rust
pub struct LocalDeploymentModule;

impl LocalDeploymentModule {
    // 检测本地 API 端点
    pub fn detect_api(request: &DeployRequest) -> Result<ProbeResult>;
    
    // 执行本地部署
    pub fn deploy(
        request: &DeployRequest,
        api_kind: ApiKind,
        run_smoke_test: bool,
    ) -> Result<DeployReport>;
    
    // 启动本地 Gateway
    pub fn start_gateway(openclaw_home: &str) -> Result<()>;
    
    // 打开本地 TUI
    pub fn open_tui(openclaw_home: &str) -> Result<()>;
}
```

**实现说明**:
- 直接调用现有的 `probe_endpoint` 和 `deploy_configuration` 函数
- 保持所有现有功能不变

### 10. Remote Deployment Module

**职责**: 协调远程部署的各个组件，提供统一的远程部署接口。

**接口**:
```rust
pub struct RemoteDeploymentModule {
    ssh_client: SshClient,
    detection: RemoteDetectionModule,
    uploader: RemoteConfigUploader,
    gateway_manager: RemoteGatewayManager,
}

impl RemoteDeploymentModule {
    pub fn new(ssh_config: SshConfig) -> Self;
    
    // 测试 SSH 连接
    pub fn test_connection(&mut self) -> Result<()>;
    
    // 检测远程 CLI
    pub fn detect_cli(&mut self) -> Result<CliDetectionResult>;
    
    // 检测远程 API
    pub fn detect_api(&self, request: &DeployRequest) -> Result<ProbeResult>;
    
    // 执行远程部署
    pub fn deploy(
        &mut self,
        request: &DeployRequest,
        api_kind: ApiKind,
    ) -> Result<RemoteDeployReport>;
    
    // 启动远程 Gateway
    pub fn start_gateway(&mut self, openclaw_home: &str) -> Result<()>;
    
    // 停止远程 Gateway
    pub fn stop_gateway(&mut self) -> Result<()>;
    
    // 获取 Gateway 运行状态
    pub fn is_gateway_running(&self) -> bool;
}
```

## Data Models

### DeployerApp State

```rust
pub struct DeployerApp {
    // 标签页管理
    tab_manager: TabManager,
    
    // 本地部署状态
    local_state: LocalDeployState,
    
    // 远程部署状态
    remote_state: RemoteDeployState,
    
    // 日志管理
    log_manager: LogManager,
    
    // 配置持久化
    config_persister: ConfigPersister,
}

pub struct LocalDeployState {
    pub openclaw_home: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub run_smoke_test: bool,
    pub last_probe: Option<ProbeResult>,
}

pub struct RemoteDeployState {
    // SSH 配置
    pub ssh_host: String,
    pub ssh_port: u16,
    pub ssh_username: String,
    pub ssh_password: String, // 不持久化
    pub ssh_auth_method: SshAuthMethod,
    pub ssh_key_path: String,
    pub ssh_key_passphrase: String, // 不持久化
    
    // 部署配置
    pub remote_openclaw_home: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    
    // 状态
    pub ssh_connected: bool,
    pub last_probe: Option<ProbeResult>,
    pub cli_detection: Option<CliDetectionResult>,
    pub gateway_running: bool,
    
    // 远程部署模块
    pub deployment_module: Option<RemoteDeploymentModule>,
}
```

### Configuration Schema

```json
{
  "local_deploy": {
    "openclaw_home": "C:\\Users\\username",
    "base_url": "https://api.example.com/v1",
    "model": "gpt-5.2",
    "run_smoke_test": false
  },
  "remote_deploy": {
    "ssh_host": "192.168.1.100",
    "ssh_port": 22,
    "ssh_username": "user",
    "ssh_auth_method": "privatekey",
    "ssh_key_path": "/path/to/key",
    "remote_openclaw_home": "/home/user",
    "base_url": "https://api.example.com/v1",
    "model": "gpt-5.2"
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

After analyzing all acceptance criteria, I identified the following redundancies:

1. **Configuration Saving (1.1, 5.1)**: Both test the same behavior (saving user input) for local and remote deployment. These can be combined into one property about configuration state management.

2. **API Detection (1.2, 5.2)**: Both test the same endpoint detection logic. Since the implementation is shared, one property covers both cases.

3. **Status Color Mapping (2.3, 7.3)**: Both test that different status types map to different colors. One property covers this behavior.

4. **Password Exclusion from Persistence (3.6, 8.2)**: Both test that passwords are not saved to disk. One property covers this security requirement.

5. **Error Message Generation (9.1, 9.4)**: Testing that errors produce messages and that errors are logged can be combined into one property about error handling.

6. **Progress Feedback (2.6, 9.6)**: Both test that long operations show progress. One property covers this UI behavior.

After reflection, the following properties provide unique validation value:

### Property 1: Configuration State Preservation
*For any* valid configuration input (local or remote), saving the configuration to application state should preserve all field values exactly as entered.
**Validates: Requirements 1.1, 5.1**

### Property 2: API Endpoint Detection
*For any* API endpoint that responds successfully to either `/responses` or `/chat/completions`, the detection module should correctly identify the API kind (openai-responses or openai-completions).
**Validates: Requirements 1.2, 5.2**

### Property 3: Configuration File Generation
*For any* valid deployment request, the deployment module should generate exactly three configuration files (openclaw.json, models.json, auth-profiles.json) with valid JSON content.
**Validates: Requirements 1.3, 5.3**

### Property 4: Backup Creation Before Overwrite
*For any* existing configuration file, deploying new configuration should create a backup file with a timestamp before overwriting the original.
**Validates: Requirements 1.4, 5.5**

### Property 5: Provider Name Invariant
*For all* generated configurations, the provider name should always be "desktopdeploy".
**Validates: Requirements 1.7**

### Property 6: Custom Directory Support
*For any* valid directory path, deployment should write configuration files to that directory (local or remote).
**Validates: Requirements 1.8, 5.6**

### Property 7: Status Color Mapping
*For any* status type (success, warning, error, info), the UI theme should map it to a distinct color.
**Validates: Requirements 2.3, 7.3**

### Property 8: Tab State Management
*For any* tab selection, the tab manager should update the active tab state to match the selection.
**Validates: Requirements 2.5**

### Property 9: Operation Progress Feedback
*For any* long-running operation, the UI should display a progress indicator while the operation is in progress.
**Validates: Requirements 2.6, 9.6**

### Property 10: SSH Password Authentication
*For any* valid SSH credentials using password authentication, the SSH client should successfully establish a connection.
**Validates: Requirements 3.2**

### Property 11: SSH Private Key Authentication
*For any* valid SSH credentials using private key authentication, the SSH client should successfully establish a connection.
**Validates: Requirements 3.3**

### Property 12: SSH Connection Status
*For any* SSH connection attempt, the SSH client should return a clear status indicating success or failure with error details.
**Validates: Requirements 3.5, 3.7**

### Property 13: Password Exclusion from Persistence
*For any* configuration saved to disk, password and passphrase fields should not be included in the persisted JSON.
**Validates: Requirements 3.6, 8.2**

### Property 14: CLI Detection Result Parsing
*For any* valid CLI detection command output, the detection module should correctly parse the installation path and version information.
**Validates: Requirements 4.2**

### Property 15: Remote File Upload
*For any* valid configuration content and remote path, the config uploader should successfully upload the file via SSH.
**Validates: Requirements 5.4**

### Property 16: Upload Failure Rollback
*For any* failed upload operation, the local configuration state should remain unchanged.
**Validates: Requirements 5.7**

### Property 17: Gateway Status Update
*For any* Gateway start operation, the deployment module should update the gateway_running flag to reflect the actual Gateway state.
**Validates: Requirements 6.3, 6.4**

### Property 18: Command Output Logging
*For any* SSH command execution, the output (stdout and stderr) should be captured and added to the log manager.
**Validates: Requirements 7.2**

### Property 19: Log Timestamp Formatting
*For all* log entries, the formatted log string should include a timestamp prefix in [HH:MM:SS] format.
**Validates: Requirements 7.4**

### Property 20: Log Rotation
*For any* log manager with max_logs limit, adding more than max_logs entries should remove the oldest entries to maintain the limit.
**Validates: Requirements 7.7**

### Property 21: Configuration Persistence Round Trip
*For any* valid application configuration, saving to disk and then loading should produce an equivalent configuration (excluding non-persisted fields like passwords).
**Validates: Requirements 8.1, 8.2, 8.3**

### Property 22: Configuration JSON Format
*For any* saved configuration file, the file content should be valid JSON that can be parsed without errors.
**Validates: Requirements 8.4**

### Property 23: Configuration File Location
*For any* configuration save operation, the configuration file should be created in the ~/.openclaw-deployer directory.
**Validates: Requirements 8.5**

### Property 24: Configuration Error Recovery
*For any* missing or corrupted configuration file, loading configuration should return default values without crashing.
**Validates: Requirements 8.6**

### Property 25: Error Message Generation
*For any* operation failure, the error handling system should generate a descriptive error message and log it with error level.
**Validates: Requirements 9.1, 9.4**

### Property 26: Error Type Classification
*For any* error, the error handling system should correctly classify it into one of the defined error types (network, filesystem, SSH, configuration).
**Validates: Requirements 9.2**

### Property 27: Success Message Generation
*For any* successful operation, the system should generate a success message and log it with success level.
**Validates: Requirements 9.5**

## Error Handling

### Error Categories

1. **Network Errors**
   - API endpoint unreachable
   - Connection timeout
   - DNS resolution failure
   - HTTP error responses (4xx, 5xx)

2. **File System Errors**
   - Permission denied
   - Disk full
   - Invalid path
   - File not found

3. **SSH Errors**
   - Authentication failure
   - Connection refused
   - Host key verification failure
   - Command execution failure
   - File transfer failure

4. **Configuration Errors**
   - Invalid JSON format
   - Missing required fields
   - Invalid field values
   - Schema validation failure

### Error Handling Strategy

1. **Graceful Degradation**: When non-critical operations fail, the application should continue functioning with reduced capabilities.

2. **User-Friendly Messages**: All errors should be translated into clear, actionable messages for users.

3. **Detailed Logging**: All errors should be logged with full context (stack traces, error codes, timestamps) for debugging.

4. **No Silent Failures**: All operations should provide explicit feedback about success or failure.

5. **Rollback on Failure**: Operations that modify state should rollback changes if any step fails.

### Error Recovery

1. **Configuration Loading**: If config file is corrupted, use default values and create new config.
2. **SSH Connection**: If connection fails, allow user to retry with different credentials.
3. **File Upload**: If upload fails, preserve local state and allow retry.
4. **Gateway Startup**: If startup fails, provide diagnostic information and allow retry.

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

- **Unit Tests**: Verify specific examples, edge cases, and integration points
- **Property Tests**: Verify universal properties across all inputs using randomized testing

### Unit Testing Focus

Unit tests should cover:
- Specific examples of configuration generation
- Edge cases like empty strings, special characters in paths
- Integration between UI components and business logic
- SSH connection with specific credential scenarios
- File system operations with specific paths
- Error conditions with specific failure scenarios

### Property-Based Testing

We will use **proptest** (Rust's property-based testing library) for property tests.

Each property test should:
- Run minimum 100 iterations
- Generate random valid inputs
- Verify the property holds for all generated inputs
- Be tagged with a comment referencing the design property

Example tag format:
```rust
// Feature: openclaw-deployer-ui-upgrade, Property 1: Configuration State Preservation
#[proptest]
fn test_configuration_state_preservation(config: ValidConfig) {
    // Test implementation
}
```

### Test Coverage Requirements

1. **Configuration Management** (Properties 1, 21-24)
   - Property tests for configuration round-trip
   - Unit tests for specific configuration scenarios
   - Edge cases: empty values, special characters, very long strings

2. **API Detection** (Property 2)
   - Property tests with various API response formats
   - Unit tests for specific API types
   - Edge cases: malformed responses, timeout scenarios

3. **File Operations** (Properties 3, 4, 6, 15)
   - Property tests for file generation and backup
   - Unit tests for specific file paths
   - Edge cases: permission errors, disk full, invalid paths

4. **SSH Operations** (Properties 10-12, 15, 18)
   - Property tests for SSH connection with various credentials
   - Unit tests for specific SSH scenarios
   - Edge cases: connection timeout, authentication failure, network errors

5. **UI State Management** (Properties 7-9, 17)
   - Property tests for state transitions
   - Unit tests for specific UI interactions
   - Edge cases: rapid state changes, concurrent operations

6. **Logging** (Properties 18-20)
   - Property tests for log rotation and formatting
   - Unit tests for specific log scenarios
   - Edge cases: very long log messages, high-frequency logging

7. **Error Handling** (Properties 13, 16, 25-27)
   - Property tests for error classification
   - Unit tests for specific error scenarios
   - Edge cases: cascading failures, error recovery

### Testing Tools

- **proptest**: Property-based testing framework
- **mockall**: Mocking framework for unit tests
- **tempfile**: Temporary file creation for file system tests
- **ssh2-mock** (if available) or custom mocks for SSH testing

### Test Organization

```
tests/
├── unit/
│   ├── config_test.rs
│   ├── ssh_test.rs
│   ├── deployment_test.rs
│   └── ui_test.rs
├── property/
│   ├── config_properties.rs
│   ├── ssh_properties.rs
│   ├── deployment_properties.rs
│   └── logging_properties.rs
└── integration/
    ├── local_deployment_test.rs
    └── remote_deployment_test.rs
```

## Implementation Notes

### SSH Library Selection

We will use **ssh2-rs** (libssh2 bindings for Rust) because:
- Mature and well-maintained
- Supports both password and key-based authentication
- Provides SFTP for file transfer
- Good error handling
- Cross-platform support

### UI Layout Strategy

The UI will use a two-column layout within each tab:
- Left column: Configuration forms and action buttons
- Right column: Status information and logs

This maintains consistency with the existing UI while adding the new remote deployment tab.

### Configuration Migration

Since we're adding new configuration fields, we need to handle migration:
- Old config files without remote_deploy section should load successfully
- Missing fields should use default values
- Config version field can be added for future migrations

### Performance Considerations

1. **SSH Connection Pooling**: Reuse SSH connections instead of creating new ones for each operation
2. **Async Operations**: Long-running operations (SSH commands, file uploads) should not block the UI
3. **Log Buffering**: Batch log updates to avoid excessive UI redraws
4. **Configuration Caching**: Cache loaded configuration in memory to avoid repeated disk reads

### Security Considerations

1. **Password Storage**: Never persist passwords or passphrases to disk
2. **SSH Key Permissions**: Verify SSH key file permissions before use
3. **API Key Display**: Mask API keys in UI (password field)
4. **Log Sanitization**: Avoid logging sensitive information (passwords, API keys)
5. **Secure Defaults**: Use secure SSH settings (no weak ciphers, verify host keys)

### Cross-Platform Compatibility

The application should work on:
- Windows (primary target)
- Linux
- macOS

Platform-specific considerations:
- Path separators (use PathBuf)
- SSH key locations (different defaults per platform)
- Command execution (cmd.exe on Windows, sh on Unix)
- Font loading (different system fonts per platform)
