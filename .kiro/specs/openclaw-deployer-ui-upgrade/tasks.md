# Implementation Plan: OpenClaw Deployer UI Upgrade

## Overview

本实施计划将 OpenClaw Desktop Deployer 升级为具有现代化深色主题的双模式部署工具（本地 + 远程 SSH）。实施将保留所有现有本地部署功能，同时添加远程部署能力和改进的用户界面。

技术栈：Rust + egui + ssh2-rs

## Tasks

- [-] 1. 项目依赖和基础设施设置
  - 添加 ssh2、serde_json 等必要依赖到 Cargo.toml
  - 创建模块结构：ui/, ssh/, config/, logging/
  - 设置 proptest 测试框架
  - _Requirements: 所有需求的基础_

- [ ] 2. 实现深色主题系统
  - [~] 2.1 创建 ThemeColors 结构体和主题配置函数
    - 定义深色主题颜色常量（背景、表面、文本、状态色）
    - 实现 configure_theme() 函数应用主题到 egui Context
    - 实现 get_theme_colors() 获取当前主题
    - _Requirements: 2.1, 2.2, 2.3, 2.7_
  
  - [~]* 2.2 编写主题系统的属性测试
    - **Property 7: Status Color Mapping**
    - **Validates: Requirements 2.3**

- [ ] 3. 实现标签页管理器
  - [~] 3.1 创建 TabManager 结构体
    - 定义 DeployTab 枚举（Local, Remote）
    - 实现标签页状态管理和切换逻辑
    - 实现 render_tabs() 渲染标签页 UI
    - _Requirements: 2.5_
  
  - [~]* 3.2 编写标签页状态管理的属性测试
    - **Property 8: Tab State Management**
    - **Validates: Requirements 2.5**

- [ ] 4. 实现配置持久化系统
  - [~] 4.1 创建配置数据模型
    - 定义 AppConfig、LocalDeployConfig、RemoteDeployConfig 结构体
    - 添加 Serialize/Deserialize 派生
    - _Requirements: 8.1, 8.2, 8.4_
  
  - [~] 4.2 实现 ConfigPersister
    - 实现配置文件路径解析（~/.openclaw-deployer/config.json）
    - 实现 load_config() 加载配置
    - 实现 save_config() 保存配置（排除密码字段）
    - 实现 default_config() 提供默认值
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6_
  
  - [~]* 4.3 编写配置持久化的属性测试
    - **Property 1: Configuration State Preservation**
    - **Property 13: Password Exclusion from Persistence**
    - **Property 21: Configuration Persistence Round Trip**
    - **Property 22: Configuration JSON Format**
    - **Property 23: Configuration File Location**
    - **Property 24: Configuration Error Recovery**
    - **Validates: Requirements 1.1, 3.6, 5.1, 8.1-8.6**
  
  - [~]* 4.4 编写配置持久化的单元测试
    - 测试特殊字符路径处理
    - 测试配置文件损坏恢复
    - 测试默认值填充
    - _Requirements: 8.6_

- [ ] 5. 实现日志管理系统
  - [~] 5.1 创建 LogManager 结构体
    - 定义 LogLevel 枚举和 LogEntry 结构体
    - 实现日志添加、获取、清空功能
    - 实现日志格式化（带时间戳和颜色）
    - 实现日志轮转（最大 1000 条）
    - _Requirements: 1.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_
  
  - [~]* 5.2 编写日志系统的属性测试
    - **Property 18: Command Output Logging**
    - **Property 19: Log Timestamp Formatting**
    - **Property 20: Log Rotation**
    - **Validates: Requirements 7.2, 7.4, 7.7**
  
  - [~]* 5.3 编写日志系统的单元测试
    - 测试高频日志写入
    - 测试超长日志消息处理
    - _Requirements: 7.7_

- [~] 6. Checkpoint - 基础设施验证
  - 确保所有基础模块编译通过
  - 确保配置和日志系统测试通过
  - 如有问题请询问用户

- [ ] 7. 实现 SSH 客户端
  - [~] 7.1 创建 SSH 配置和客户端结构
    - 定义 SshAuthMethod 枚举（Password, PrivateKey）
    - 定义 SshConfig 和 CommandOutput 结构体
    - 创建 SshClient 结构体框架
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [~] 7.2 实现 SSH 连接管理
    - 实现 connect() 建立 SSH 连接（支持密码和私钥认证）
    - 实现 disconnect() 断开连接
    - 实现 is_connected() 检查连接状态
    - 添加连接超时和错误处理
    - _Requirements: 3.2, 3.3, 3.5, 3.7_
  
  - [~] 7.3 实现 SSH 命令执行
    - 实现 execute_command() 执行远程命令
    - 捕获 stdout、stderr 和退出码
    - 添加命令超时处理
    - _Requirements: 4.1, 6.1, 7.2_
  
  - [~] 7.4 实现 SSH 文件操作
    - 实现 upload_file() 上传文件内容到远程
    - 实现 file_exists() 检查远程文件
    - 实现 rename_file() 重命名远程文件（用于备份）
    - 使用 SFTP 协议
    - _Requirements: 5.4, 5.5_
  
  - [~]* 7.5 编写 SSH 客户端的属性测试
    - **Property 10: SSH Password Authentication**
    - **Property 11: SSH Private Key Authentication**
    - **Property 12: SSH Connection Status**
    - **Validates: Requirements 3.2, 3.3, 3.5, 3.7**
  
  - [~]* 7.6 编写 SSH 客户端的单元测试
    - 测试连接超时场景
    - 测试认证失败场景
    - 测试网络错误场景
    - _Requirements: 3.7, 9.1, 9.2_

- [ ] 8. 实现远程检测模块
  - [~] 8.1 创建 RemoteDetectionModule
    - 实现 detect_openclaw_cli() 检测远程 CLI
    - 解析 `which openclaw` 和 `openclaw --version` 输出
    - 返回 CliDetectionResult（安装状态、路径、版本）
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [~] 8.2 实现远程 API 检测
    - 实现 detect_remote_api() 复用现有 probe_endpoint
    - 从本地测试远程 API 端点可用性
    - _Requirements: 5.2_
  
  - [~]* 8.3 编写检测模块的属性测试
    - **Property 2: API Endpoint Detection**
    - **Property 14: CLI Detection Result Parsing**
    - **Validates: Requirements 1.2, 4.2, 5.2**
  
  - [~]* 8.4 编写检测模块的单元测试
    - 测试各种 CLI 输出格式
    - 测试 CLI 未安装场景
    - _Requirements: 4.3_

- [ ] 9. 实现远程配置上传器
  - [~] 9.1 创建 RemoteConfigUploader
    - 实现 upload_configs() 上传配置文件
    - 复用现有的 upsert_* 函数生成配置内容
    - 实现 create_remote_backup() 创建远程备份
    - 返回 RemoteDeployReport
    - _Requirements: 5.3, 5.4, 5.5, 5.6_
  
  - [~]* 9.2 编写配置上传器的属性测试
    - **Property 3: Configuration File Generation**
    - **Property 4: Backup Creation Before Overwrite**
    - **Property 5: Provider Name Invariant**
    - **Property 6: Custom Directory Support**
    - **Property 15: Remote File Upload**
    - **Property 16: Upload Failure Rollback**
    - **Validates: Requirements 1.3, 1.4, 1.7, 1.8, 5.3, 5.4, 5.5, 5.6, 5.7**
  
  - [~]* 9.3 编写配置上传器的单元测试
    - 测试上传失败回滚
    - 测试备份文件命名
    - _Requirements: 5.7_

- [ ] 10. 实现远程 Gateway 管理器
  - [~] 10.1 创建 RemoteGatewayManager
    - 实现 start_gateway() 启动远程 Gateway
    - 使用 nohup 在后台运行 openclaw gateway
    - 实现 stop_gateway() 停止远程 Gateway
    - 实现 is_running() 检查运行状态
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  
  - [~]* 10.2 编写 Gateway 管理器的属性测试
    - **Property 17: Gateway Status Update**
    - **Validates: Requirements 6.3, 6.4**
  
  - [~]* 10.3 编写 Gateway 管理器的单元测试
    - 测试 Gateway 启动失败场景
    - 测试进程检测逻辑
    - _Requirements: 6.4_

- [~] 11. Checkpoint - 远程组件验证
  - 确保所有远程部署组件编译通过
  - 确保 SSH 和远程操作测试通过
  - 如有问题请询问用户

- [ ] 12. 实现本地部署模块（封装现有逻辑）
  - [~] 12.1 创建 LocalDeploymentModule
    - 封装现有的 probe_endpoint 为 detect_api()
    - 封装现有的 deploy_configuration 为 deploy()
    - 实现 start_gateway() 启动本地 Gateway
    - 实现 open_tui() 打开本地 TUI
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_
  
  - [~]* 12.2 编写本地部署模块的单元测试
    - 测试配置文件生成
    - 测试备份创建
    - 测试 Gateway 启动
    - _Requirements: 1.3, 1.4, 1.5_

- [ ] 13. 实现远程部署模块（协调器）
  - [~] 13.1 创建 RemoteDeploymentModule
    - 组合 SshClient、RemoteDetectionModule、RemoteConfigUploader、RemoteGatewayManager
    - 实现 test_connection() 测试 SSH 连接
    - 实现 detect_cli() 检测远程 CLI
    - 实现 detect_api() 检测远程 API
    - 实现 deploy() 执行远程部署
    - 实现 start_gateway() 和 stop_gateway()
    - 实现 is_gateway_running() 状态查询
    - _Requirements: 3.5, 4.1, 5.2, 5.3, 6.1, 6.5_
  
  - [~]* 13.2 编写远程部署模块的集成测试
    - 测试完整的远程部署流程
    - 测试错误恢复场景
    - _Requirements: 5.7, 9.1_

- [ ] 14. 实现应用程序状态管理
  - [~] 14.1 创建 DeployerApp 状态结构
    - 定义 LocalDeployState 和 RemoteDeployState
    - 集成 TabManager、LogManager、ConfigPersister
    - 实现状态初始化和配置加载
    - _Requirements: 8.3_
  
  - [~] 14.2 实现状态更新逻辑
    - 实现配置字段更新
    - 实现操作状态更新（连接状态、部署状态等）
    - 实现日志添加
    - _Requirements: 1.1, 5.1, 6.3, 7.1_

- [ ] 15. 实现本地部署 UI
  - [~] 15.1 创建本地部署标签页 UI
    - 实现配置输入表单（OpenClaw 目录、请求地址、API Key、模型）
    - 实现"检测接口"按钮和结果显示
    - 实现"一键部署"按钮
    - 实现"启动 Gateway"和"打开 TUI"按钮
    - 使用卡片式布局和深色主题
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 2.4, 2.5_
  
  - [~] 15.2 实现本地部署操作处理
    - 连接 UI 按钮到 LocalDeploymentModule
    - 实现操作进度反馈
    - 实现操作结果显示（成功/失败消息）
    - 更新日志显示
    - _Requirements: 1.2, 1.3, 1.5, 1.6, 2.6, 9.5, 9.6_
  
  - [~]* 15.3 编写本地部署 UI 的单元测试
    - 测试 UI 状态更新
    - 测试按钮点击处理
    - _Requirements: 1.1, 1.2_

- [ ] 16. 实现远程部署 UI
  - [~] 16.1 创建远程部署标签页 UI
    - 实现 SSH 配置输入表单（主机、端口、用户名、认证方式）
    - 实现密码输入和私钥文件选择
    - 实现"测试连接"按钮和连接状态显示
    - 实现"检测远程 CLI"按钮和结果显示
    - 使用卡片式布局和深色主题
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 2.4, 2.5_
  
  - [~] 16.2 实现远程部署配置 UI
    - 实现远程配置输入表单（远程目录、请求地址、API Key、模型）
    - 实现"检测远程接口"按钮
    - 实现"远程部署"按钮
    - 实现"启动远程 Gateway"和"停止 Gateway"按钮
    - 显示 Gateway 运行状态指示器
    - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.3, 6.5_
  
  - [~] 16.3 实现远程部署操作处理
    - 连接 UI 按钮到 RemoteDeploymentModule
    - 实现 SSH 连接建立和断开
    - 实现操作进度反馈
    - 实现操作结果显示
    - 更新日志显示（显示远程命令输出）
    - _Requirements: 3.5, 3.7, 4.1, 5.2, 5.3, 6.1, 6.4, 7.2, 2.6, 9.5, 9.6_
  
  - [~]* 16.4 编写远程部署 UI 的单元测试
    - 测试 SSH 配置 UI 状态
    - 测试连接状态更新
    - 测试 Gateway 状态显示
    - _Requirements: 3.5, 6.3_

- [ ] 17. 实现日志显示 UI
  - [~] 17.1 创建日志显示组件
    - 实现日志文本区域（支持滚动）
    - 实现日志颜色编码（Info、Warning、Error、Success）
    - 实现"清空日志"按钮
    - 在本地和远程标签页中集成日志显示
    - _Requirements: 1.6, 7.1, 7.3, 7.5, 7.6_
  
  - [~]* 17.2 编写日志显示的单元测试
    - 测试日志格式化
    - 测试日志滚动
    - _Requirements: 7.6_

- [ ] 18. 实现错误处理系统
  - [~] 18.1 创建错误类型定义
    - 定义 DeployerError 枚举（Network, FileSystem, Ssh, Configuration）
    - 实现错误分类逻辑
    - 实现用户友好的错误消息生成
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [~] 18.2 集成错误处理到所有模块
    - 在所有操作中添加错误捕获
    - 将错误转换为用户消息
    - 记录详细错误到日志
    - 显示错误提示（使用错误颜色和图标）
    - _Requirements: 3.7, 5.7, 6.4, 9.1, 9.2, 9.3, 9.4_
  
  - [~]* 18.3 编写错误处理的属性测试
    - **Property 25: Error Message Generation**
    - **Property 26: Error Type Classification**
    - **Property 27: Success Message Generation**
    - **Validates: Requirements 9.1, 9.2, 9.4, 9.5**
  
  - [~]* 18.4 编写错误处理的单元测试
    - 测试各种错误场景
    - 测试错误消息格式
    - 测试错误恢复
    - _Requirements: 9.1, 9.2_

- [~] 19. Checkpoint - UI 集成验证
  - 确保所有 UI 组件正确渲染
  - 确保本地和远程部署流程可以完整执行
  - 测试标签页切换
  - 测试配置保存和加载
  - 如有问题请询问用户

- [ ] 20. 实现应用程序关闭处理
  - [~] 20.1 添加关闭确认逻辑
    - 检测远程 Gateway 是否正在运行
    - 如果运行中，提示用户是否保持运行
    - 实现优雅关闭（断开 SSH 连接、保存配置）
    - _Requirements: 6.6_
  
  - [~]* 20.2 编写关闭处理的单元测试
    - 测试关闭提示逻辑
    - 测试资源清理
    - _Requirements: 6.6_

- [ ] 21. 实现进度指示器
  - [~] 21.1 添加操作进度反馈
    - 在长时间操作期间显示加载指示器
    - 实现操作状态文本更新
    - 禁用操作按钮防止重复点击
    - _Requirements: 2.6, 9.6_
  
  - [~]* 21.2 编写进度指示器的属性测试
    - **Property 9: Operation Progress Feedback**
    - **Validates: Requirements 2.6, 9.6**

- [ ] 22. 跨平台兼容性测试和修复
  - [~] 22.1 测试 Windows 平台
    - 测试路径处理（反斜杠）
    - 测试命令执行（cmd.exe）
    - 测试 SSH 密钥路径
    - _Requirements: 所有需求_
  
  - [~] 22.2 测试 Linux/macOS 平台
    - 测试路径处理（正斜杠）
    - 测试命令执行（sh）
    - 测试 SSH 密钥权限
    - _Requirements: 所有需求_
  
  - [~]* 22.3 修复平台特定问题
    - 根据测试结果修复兼容性问题
    - _Requirements: 所有需求_

- [ ] 23. 最终集成测试
  - [~]* 23.1 执行完整的本地部署流程测试
    - 测试从配置输入到 Gateway 启动的完整流程
    - 验证配置持久化
    - 验证日志记录
    - _Requirements: 1.1-1.8_
  
  - [~]* 23.2 执行完整的远程部署流程测试
    - 测试从 SSH 连接到远程 Gateway 启动的完整流程
    - 验证远程文件上传
    - 验证远程命令执行
    - 验证日志记录
    - _Requirements: 3.1-3.7, 4.1-4.4, 5.1-5.7, 6.1-6.6, 7.1-7.7_
  
  - [~]* 23.3 执行错误场景测试
    - 测试网络错误处理
    - 测试认证失败处理
    - 测试文件系统错误处理
    - 测试配置错误处理
    - _Requirements: 9.1-9.6_

- [~] 24. 最终 Checkpoint - 完整性验证
  - 确保所有功能正常工作
  - 确保所有测试通过
  - 确保 UI 美观且易用
  - 确保错误处理完善
  - 如有问题请询问用户

## Notes

- 任务标记 `*` 的为可选测试任务，可以跳过以加快 MVP 开发
- 每个任务都引用了具体的需求编号以便追溯
- Checkpoint 任务确保增量验证
- 属性测试验证通用正确性属性（最少 100 次迭代）
- 单元测试验证特定示例和边缘情况
- 保持现有本地部署功能完全兼容是最高优先级
