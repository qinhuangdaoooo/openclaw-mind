# openClaw-mind

<div align="center">

![openClaw-mind](https://img.shields.io/badge/openClaw-mind-blue)
![Version](https://img.shields.io/badge/version-0.1.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)

一个现代化的桌面应用，用于管理和编排 OpenClaw 多个 Agent（AI 员工），组建协同工作的智能小队，完成各自任务并互相协作。

[功能特性](#功能特性) • [快速开始](#快速开始) • [开发指南](#开发指南) • [构建](#构建) • [文档](#文档)

</div>

## ✨ 功能特性

### 核心功能

- 🎯 **Agent 管理** - 创建、编辑、删除 OpenClaw Agent，配置各自工作区和默认模型
- ⚡ **技能管理** - 浏览、搜索、管理工作区技能（按 Agent 维度查看）
- 🤖 **AI 推荐**  
  - 在 Skills → AI 推荐 中，使用已配置的大模型理解你的自然语言需求并推荐技能  
  - 支持指定 Provider 与模型（优先使用 Agents 默认模型，其次 DeepSeek/Kimi，最后任意有 API Key 的 Provider）
- ✨ **AI 生成 Agent 配置** - 一键用大模型生成 `SOUL.md` / `AGENTS.md` / `MEMORY.md` 并写入工作区
- ⚙️ **配置管理** - 在 Config 页面可视化编辑 OpenClaw 配置（包括多模型 Provider、默认工作区、默认 Agent 模型等）
- 🔌 **SSH 连接** - 远程部署和管理 OpenClaw
- 🛠️ **环境检测** - 检测必需的开发工具（Node.js, Git 等），并提供一键安装入口（部分依赖仍需手动安装）

### 技术亮点

- 🚀 **极致性能** - 基于 Rust + Tauri，启动快、内存占用低
- 💾 **体积小巧** - 安装包仅 3-5MB（相比 Electron 减少 95%）
- 🎨 **现代 UI** - 深色主题，流畅动画
- 🌐 **多 Provider** - 支持 DeepSeek、Kimi、OpenAI 等多个 AI Provider
- 📦 **跨平台** - 支持 Windows、macOS、Linux

## 📊 性能对比

| 指标 | Electron 版本 | Tauri 版本 | 改进 |
|------|--------------|-----------|------|
| 安装包大小 | ~100MB | ~3-5MB | ↓ 95% |
| 内存占用 | ~150MB | ~30-50MB | ↓ 70% |
| 启动时间 | ~2-3s | ~0.5-1s | ↓ 60% |

## 🚀 快速开始

### 环境要求

- Node.js 18+
- pnpm 8+
- Rust 1.70+
- Windows: Visual Studio Build Tools
- macOS: Xcode Command Line Tools
- Linux: webkit2gtk 等依赖（见 [BUILD.md](BUILD.md)）

### 安装依赖

```bash
# 安装前端依赖
pnpm install
```

### 启动开发服务器

```bash
pnpm tauri:dev
```

首次运行会编译 Rust 代码，需要 5-10 分钟。

## 🛠️ 开发指南

### 项目结构

```
openclaw-manager/
├── src/                    # Next.js 前端
│   ├── app/               # 页面和布局
│   ├── components/        # React 组件
│   └── lib/               # API 封装
├── src-tauri/             # Rust 后端
│   ├── src/
│   │   ├── commands/      # Tauri Commands
│   │   ├── services/      # 业务逻辑
│   │   ├── models/        # 数据模型
│   │   └── main.rs        # 应用入口
│   ├── Cargo.toml         # Rust 依赖
│   └── tauri.conf.json    # Tauri 配置
└── package.json           # 前端依赖
```

### 技术栈

**后端**
- Rust - 系统编程语言
- Tauri 2.0 - 桌面应用框架
- Tokio - 异步运行时
- Reqwest - HTTP 客户端
- Serde - 序列化/反序列化

**前端**
- Next.js 15 - React 框架
- React 19 - UI 库
- TypeScript - 类型系统
- Tailwind CSS - 样式框架

### 开发命令

```bash
# 启动开发服务器
pnpm tauri:dev

# 构建生产版本
pnpm tauri:build

# 运行前端开发服务器
pnpm dev

# 构建前端
pnpm build

# 代码检查
pnpm lint
```

## 📦 构建

### 构建所有平台

```bash
pnpm tauri:build
```

### 构建特定平台

```bash
# Windows
pnpm tauri build --target x86_64-pc-windows-msvc

# macOS (Intel)
pnpm tauri build --target x86_64-apple-darwin

# macOS (Apple Silicon)
pnpm tauri build --target aarch64-apple-darwin

# Linux
pnpm tauri build --target x86_64-unknown-linux-gnu
```

详细构建指南请参考 [BUILD.md](BUILD.md)。

## 📖 文档

- [构建指南](BUILD.md) - 详细的构建和发布说明
- [开发总结](DEVELOPMENT-SUMMARY.md) - 项目开发进度和状态
- [设置指南](SETUP-GUIDE.md) - 环境设置详细步骤
- [Tauri 说明](README-TAURI.md) - Tauri 相关文档

## 🎯 使用说明

### 1. 配置 AI Provider 与默认模型

在 Config 页面配置你的 AI Provider，并设置默认模型。应用会按以下优先级选择用于调用的大模型：

1. `agents.defaults.model.primary` 指定的 Provider
2. `models.providers.deepseek`（若存在且配置了 `api_key`）
3. `models.providers.kimi`（若存在且配置了 `api_key`）
4. 其他任意第一个配置了 `api_key` 的 Provider

示例配置：

```json
{
  "agents": {
    "defaults": {
      "workspace": "C:/Users/you/.openclaw/workspace",
      "model": {
        "primary": "deepseek"
      }
    }
  },
  "models": {
    "mode": "local",
    "providers": {
      "deepseek": {
        "api": "https://api.deepseek.com/v1",
        "api_key": "your-api-key",
        "models": ["deepseek-chat"]
      }
    }
  }
}
```

> **注意**：  
> - AI 相关功能（AI 推荐技能、AI 生成 Agent 配置）都会复用上述 Provider 与 `models[0]` 作为默认模型。  
> - 如果网关不是标准 `/v1` 路径，应用会自动在末尾补上 `/v1`。

### 2. 管理 Agent

在 Agents 页面：
- 创建新 Agent
- 编辑 Agent 配置文件
- 删除不需要的 Agent

### 3. 管理与推荐技能

在 Skills 页面：

- **工作区**：按 Agent 维度查看各自工作区下的技能  
  - 主 Agent：使用默认工作区（`agents.defaults.workspace`，默认为 `~/.openclaw/workspace`）  
  - 其他 Agent：使用各自配置的 workspace（`<workspace>/skills`）
- **AI 推荐**：在 “AI 推荐” 子页中：
  - 输入自然语言需求，使用已配置的大模型推荐技能列表
  - 当前版本会调用后端 REST API（非流式）获取完整推荐结果
  - 推荐结果中的“安装”按钮会尝试将技能安装到 **默认工作区**，底层通过 CLI 完成

> **关于一键安装技能（重要说明）**  
> - 后端目前通过命令行调用 `@openclaw/cli` 完成技能安装：  
>   `npx @openclaw/cli skill add <skill-slug>`  
> - 这要求你的环境里已经能够正常使用该 CLI（例如：  
>   - `@openclaw/cli` 已发布到你可访问的 npm registry，且 `npm`/`npx` 已配置正确；或  
>   - 你在本机通过其它方式安装了兼容的 CLI 并映射为 `@openclaw/cli`）。  
> - 如果 CLI 包不存在或 registry 未配置，你会在 UI 中看到 **404 / 安装失败** 的错误提示，此时可以：  
>   - 手动在对应工作区执行你自定义的安装命令；或  
>   - 按实际情况修改后端的安装命令实现。

### 4. 远程部署

在 Connect 页面：
- 配置 SSH 连接
- 测试连接
- 执行远程命令

## 🤝 贡献

欢迎贡献代码、报告问题或提出建议！

## 📄 许可证

MIT License

## 🙏 致谢

- [Tauri](https://tauri.app/) - 优秀的桌面应用框架
- [Next.js](https://nextjs.org/) - 强大的 React 框架
- [OpenClaw](https://openclaw.ai/) - 灵感来源

---

<div align="center">
Made with ❤️ by openClaw-mind
</div>
