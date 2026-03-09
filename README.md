# openclaw-desktop-deployer

一个最小可用的 Rust 桌面工具，用来做 OpenClaw 的一键部署。

## 直接使用

如果你只是想直接打开桌面工具，不需要先编译源码，直接运行：

```text
dist\openclaw-desktop-deployer\openclaw-desktop-deployer.exe
```

当前版本特性：

- 输入请求地址、API Key、模型
- 自动探测接口类型：`openai-responses` 或 `openai-completions`
- 自动写入 `~/.openclaw/openclaw.json`
- 自动写入 `~/.openclaw/agents/main/agent/models.json`
- 自动写入 `~/.openclaw/agents/main/agent/auth-profiles.json`
- 覆盖前自动备份旧文件
- 可选执行 `openclaw agent --local` 冒烟测试

当前版本暂不包含：

- QQ Bridge 一键部署
- 多 agent 管理
- 安装 OpenClaw CLI 本体

## 运行

```powershell
cd d:\OpenClaw-QQ归档-2026-02-11\openclaw-desktop-deployer
cargo run
```

说明：

- 仓库内已提供 `rust-toolchain.toml`，默认使用 `stable-x86_64-pc-windows-gnu`
- 源码构建需要可用的 MinGW 工具链（当前这台机器使用的是 WinLibs）
- 如果项目路径包含中文，某些 `dlltool`/MinGW 组合可能在默认 `target` 目录下失败；此时建议先指定纯英文构建目录，例如：

```powershell
$env:CARGO_TARGET_DIR='D:\openclaw_build\target'
cargo run
```

## 构建发布版

```powershell
cd d:\OpenClaw-QQ归档-2026-02-11\openclaw-desktop-deployer
cargo build --release
```

如果路径包含中文，建议：

```powershell
$env:CARGO_TARGET_DIR='D:\openclaw_build\target'
cargo build --release
```

发布版可执行文件路径：

```text
openclaw-desktop-deployer\target\release\openclaw-desktop-deployer.exe
```

如果使用了自定义 `CARGO_TARGET_DIR`，发布版会出现在：

```text
D:\openclaw_build\target\x86_64-pc-windows-gnu\release\openclaw-desktop-deployer.exe
```

## 使用说明

1. 打开程序
2. 填写：请求地址、API Key、模型
3. 按需修改 OpenClaw 配置目录（默认是当前 Windows 用户的 `.openclaw`）
4. 先点“检测接口”
5. 成功后点“一键部署”
6. 如果本机已安装 OpenClaw CLI，勾选的冒烟测试会自动执行

## 写入策略

工具默认使用固定 provider：`desktopdeploy`

写入后的默认模型将变成：

```text
desktopdeploy/<你输入的模型名>
```

如果目标文件原本已存在，程序会在同目录生成：

```text
*.bak-YYYYMMDD-HHMMSS
```

## 说明

如果你的接口：

- `POST /responses` 可用，程序会写成 `openai-responses`
- 否则若 `POST /chat/completions` 可用，程序会写成 `openai-completions`

这样可以做到“只输入地址、Key、模型”，不用额外手选 API 类型。
