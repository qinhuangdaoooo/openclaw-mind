# Requirements Document

## Introduction

本文档定义了 OpenClaw Desktop Deployer UI 升级功能的需求。该功能旨在保留现有的本地部署能力，同时升级用户界面为现代化的深色主题风格，并新增远程 SSH 部署功能，使用户能够通过图形界面远程部署和管理 OpenClaw 实例。

## Glossary

- **Deployer**: OpenClaw Desktop Deployer 应用程序
- **Local_Deployment**: 在本地机器上部署 OpenClaw 的功能模块
- **Remote_Deployment**: 通过 SSH 连接到远程服务器并部署 OpenClaw 的功能模块
- **Gateway**: OpenClaw Gateway 服务，用于处理 API 请求
- **TUI**: Terminal User Interface，OpenClaw 的终端用户界面
- **SSH_Client**: 用于建立和管理 SSH 连接的客户端组件
- **Config_Uploader**: 负责上传配置文件到远程服务器的组件
- **Detection_Module**: 检测 OpenClaw CLI 是否已安装的模块
- **UI_Theme**: 用户界面主题系统，负责管理颜色、字体和布局样式

## Requirements

### Requirement 1: 保留现有本地部署功能

**User Story:** 作为用户，我希望所有现有的本地部署功能继续正常工作，以便我能够像以前一样在本地机器上部署 OpenClaw。

#### Acceptance Criteria

1. WHEN 用户在本地部署标签页中输入请求地址、API Key 和模型名称 THEN THE Deployer SHALL 保存这些配置信息
2. WHEN 用户点击"检测接口"按钮 THEN THE Detection_Module SHALL 测试 `/responses` 和 `/chat/completions` 端点并返回接口类型
3. WHEN 用户点击"一键部署"按钮 THEN THE Local_Deployment SHALL 写入 `openclaw.json`、`models.json` 和 `auth-profiles.json` 到本地配置目录
4. WHEN 配置文件已存在 THEN THE Local_Deployment SHALL 在覆盖前创建带时间戳的备份文件
5. WHEN 用户选择启动 Gateway THEN THE Local_Deployment SHALL 执行 `openclaw agent --local` 命令
6. WHEN 用户选择打开 TUI THEN THE Local_Deployment SHALL 启动 OpenClaw 的终端界面
7. THE Local_Deployment SHALL 使用固定 provider 名称 `desktopdeploy`
8. THE Local_Deployment SHALL 支持用户自定义 OpenClaw 配置目录路径

### Requirement 2: 现代化深色主题界面

**User Story:** 作为用户，我希望界面采用现代化的深色主题设计，类似 OpenClaw 官方界面风格，以便获得更好的视觉体验和更低的眼睛疲劳。

#### Acceptance Criteria

1. THE UI_Theme SHALL 使用深色背景色调作为主要界面颜色
2. THE UI_Theme SHALL 使用高对比度的文字颜色以确保可读性
3. WHEN 显示不同状态信息时 THEN THE UI_Theme SHALL 使用不同颜色的状态指示器（成功、警告、错误、进行中）
4. THE Deployer SHALL 使用卡片式布局组织相关功能区域
5. THE Deployer SHALL 在界面顶部提供标签页切换功能（本地部署、远程部署）
6. WHEN 执行操作时 THEN THE Deployer SHALL 显示清晰的进度反馈和加载指示器
7. THE UI_Theme SHALL 使用圆角和阴影效果增强视觉层次感

### Requirement 3: 远程 SSH 连接配置

**User Story:** 作为用户，我希望能够配置 SSH 连接参数，以便连接到远程服务器进行部署操作。

#### Acceptance Criteria

1. THE Remote_Deployment SHALL 提供输入字段用于配置主机地址、端口、用户名
2. THE Remote_Deployment SHALL 支持密码认证方式
3. THE Remote_Deployment SHALL 支持 SSH 私钥文件认证方式
4. WHEN 用户选择私钥认证 THEN THE Remote_Deployment SHALL 提供文件选择器用于选择私钥文件
5. WHEN 用户点击"测试连接"按钮 THEN THE SSH_Client SHALL 尝试建立 SSH 连接并返回连接状态
6. THE Remote_Deployment SHALL 保存 SSH 连接配置（不包括密码）以便下次使用
7. WHEN SSH 连接失败 THEN THE SSH_Client SHALL 显示详细的错误信息

### Requirement 4: 远程 OpenClaw CLI 检测

**User Story:** 作为用户，我希望在远程部署前能够检测远程服务器上是否已安装 OpenClaw CLI，以便确认部署环境是否就绪。

#### Acceptance Criteria

1. WHEN 用户点击"检测远程 CLI"按钮 THEN THE Detection_Module SHALL 通过 SSH 执行 `which openclaw` 或等效命令
2. WHEN OpenClaw CLI 已安装 THEN THE Detection_Module SHALL 显示 CLI 的安装路径和版本信息
3. WHEN OpenClaw CLI 未安装 THEN THE Detection_Module SHALL 显示未找到的提示信息
4. THE Detection_Module SHALL 在远程检测期间显示加载状态

### Requirement 5: 远程配置文件部署

**User Story:** 作为用户，我希望能够将 OpenClaw 配置文件上传到远程服务器，以便在远程环境中部署 OpenClaw 实例。

#### Acceptance Criteria

1. WHEN 用户在远程部署标签页中输入请求地址、API Key 和模型名称 THEN THE Remote_Deployment SHALL 保存这些配置信息
2. WHEN 用户点击"检测远程接口"按钮 THEN THE Detection_Module SHALL 从本地测试远程 API 端点的可用性
3. WHEN 用户点击"远程部署"按钮 THEN THE Config_Uploader SHALL 生成 `openclaw.json`、`models.json` 和 `auth-profiles.json` 配置内容
4. WHEN 配置内容生成后 THEN THE Config_Uploader SHALL 通过 SSH 将配置文件上传到远程服务器的 OpenClaw 配置目录
5. WHEN 远程配置文件已存在 THEN THE Config_Uploader SHALL 在覆盖前通过 SSH 创建带时间戳的备份文件
6. THE Remote_Deployment SHALL 支持用户自定义远程 OpenClaw 配置目录路径
7. WHEN 上传失败 THEN THE Config_Uploader SHALL 显示详细的错误信息并保持本地配置不变

### Requirement 6: 远程 Gateway 启动

**User Story:** 作为用户，我希望能够通过界面启动远程服务器上的 OpenClaw Gateway，以便快速启动远程部署的实例。

#### Acceptance Criteria

1. WHEN 用户点击"启动远程 Gateway"按钮 THEN THE Remote_Deployment SHALL 通过 SSH 执行 `openclaw agent --local` 命令
2. THE Remote_Deployment SHALL 在后台保持 SSH 会话以维持 Gateway 进程运行
3. WHEN Gateway 启动成功 THEN THE Remote_Deployment SHALL 显示 Gateway 运行状态指示器
4. WHEN Gateway 启动失败 THEN THE Remote_Deployment SHALL 显示错误信息和失败原因
5. THE Remote_Deployment SHALL 提供"停止 Gateway"按钮用于终止远程 Gateway 进程
6. WHEN 用户关闭应用程序 THEN THE Remote_Deployment SHALL 提示用户是否保持远程 Gateway 继续运行

### Requirement 7: 远程操作日志显示

**User Story:** 作为用户，我希望能够看到远程操作的详细日志输出，以便了解部署过程和排查问题。

#### Acceptance Criteria

1. THE Remote_Deployment SHALL 提供日志显示区域用于展示远程操作输出
2. WHEN 执行远程 SSH 命令时 THEN THE Remote_Deployment SHALL 实时显示命令的标准输出和标准错误
3. THE Remote_Deployment SHALL 为不同类型的日志消息使用不同的颜色（信息、警告、错误）
4. THE Remote_Deployment SHALL 在日志消息前添加时间戳
5. THE Remote_Deployment SHALL 提供"清空日志"按钮用于清除日志显示区域
6. THE Remote_Deployment SHALL 支持日志内容的滚动查看
7. WHEN 日志内容超过一定行数 THEN THE Remote_Deployment SHALL 自动删除最旧的日志行以防止内存溢出

### Requirement 8: 配置持久化

**User Story:** 作为用户，我希望应用程序能够保存我的配置信息，以便下次打开时不需要重新输入。

#### Acceptance Criteria

1. WHEN 用户输入本地部署配置 THEN THE Deployer SHALL 将配置保存到本地配置文件
2. WHEN 用户输入远程部署配置 THEN THE Deployer SHALL 将配置（不包括密码）保存到本地配置文件
3. WHEN 应用程序启动时 THEN THE Deployer SHALL 从本地配置文件加载上次保存的配置
4. THE Deployer SHALL 使用 JSON 格式存储配置文件
5. THE Deployer SHALL 将配置文件保存在用户主目录的 `.openclaw-deployer` 目录下
6. WHEN 配置文件不存在或损坏 THEN THE Deployer SHALL 使用默认配置值并创建新的配置文件

### Requirement 9: 错误处理和用户反馈

**User Story:** 作为用户，我希望在操作失败时能够看到清晰的错误信息，以便了解问题所在并采取相应措施。

#### Acceptance Criteria

1. WHEN 任何操作失败时 THEN THE Deployer SHALL 显示包含错误原因的提示消息
2. THE Deployer SHALL 区分不同类型的错误（网络错误、文件系统错误、SSH 错误、配置错误）
3. WHEN 显示错误消息时 THEN THE Deployer SHALL 使用错误状态颜色和图标
4. THE Deployer SHALL 在日志区域记录详细的错误堆栈信息以便调试
5. WHEN 操作成功时 THEN THE Deployer SHALL 显示成功提示消息
6. THE Deployer SHALL 在执行长时间操作时显示进度指示器防止用户误以为程序无响应
