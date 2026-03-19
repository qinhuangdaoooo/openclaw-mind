import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

// 窗口控制
export const windowApi = {
    minimize: () => invoke('minimize_window'),
    maximize: () => invoke('maximize_window'),
    close: () => invoke('close_window'),
}

// 配置管理
export interface ProviderModel {
    id?: string
    name?: string
    api?: string
    reasoning?: boolean
    input?: string[]
    contextWindow?: number
    maxTokens?: number
    [key: string]: any
}

export type ProviderModelEntry = string | ProviderModel

export interface ProviderConfig {
    api: string
    apiKey?: string
    api_key?: string
    baseUrl?: string
    base_url?: string
    models?: ProviderModelEntry[]
    [key: string]: any
}

export interface OpenclawConfig {
    meta?: Record<string, any>
    env?: Record<string, string>
    gateway?: {
        mode?: string
        port?: number
        auth?: {
            mode?: string
            token?: string
            password?: string
            [key: string]: any
        }
        [key: string]: any
    }
    models?: {
        mode?: string
        providers: Record<string, ProviderConfig>
        [key: string]: any
    }
    agents?: {
        defaults?: {
            workspace?: string
            model?: {
                primary?: string
                fallbacks?: string[]
                [key: string]: any
            }
            [key: string]: any
        }
        list?: Array<{
            id: string
            name?: string
            workspace?: string
            model?: {
                primary?: string
                fallbacks?: string[]
                [key: string]: any
            }
            [key: string]: any
        }>
        [key: string]: any
    }
    bindings?: Array<{
        agentId: string
        match: {
            channel: string
            peer?: {
                kind: 'private' | 'group' | 'channel' | string
                id: string
            }
            [key: string]: any
        }
        [key: string]: any
    }>
    channels?: {
        feishu?: Record<string, any>
        qqBridge?: Record<string, any>
        whatsapp?: {
            groupPolicy?: 'open' | 'allowlist' | string
            allowFrom?: string[]
            groups?: Record<string, { requireMention?: boolean; [key: string]: any }>
            [key: string]: any
        }
        [key: string]: any
    }
    canvasHost?: {
        enabled?: boolean
        port?: number
        [key: string]: any
    }
    messages?: {
        groupChat?: {
            mentionPatterns?: string[]
            [key: string]: any
        }
        [key: string]: any
    }
    tools?: {
        agentToAgent?: {
            enabled?: boolean
            allow?: string[]
            [key: string]: any
        }
        [key: string]: any
    }
    [key: string]: any
}

export function getProviderApiKey(provider?: ProviderConfig | null): string | undefined {
    return provider?.apiKey ?? provider?.api_key
}

export function getProviderBaseUrl(provider?: ProviderConfig | null): string | undefined {
    return provider?.baseUrl ?? provider?.base_url ?? provider?.api
}

export function getProviderModelId(model?: ProviderModelEntry | null): string | undefined {
    if (!model) return undefined
    return typeof model === 'string' ? model : model.id ?? model.name
}

export function getProviderModelLabel(model?: ProviderModelEntry | null): string {
    if (!model) return ''
    return typeof model === 'string' ? model : model.name ?? model.id ?? ''
}

export function getDefaultProviderId(config?: OpenclawConfig | null): string | undefined {
    const primary = config?.agents?.defaults?.model?.primary
    return primary?.split('/')[0]
}

export function buildProviderPrimary(providerId: string, provider?: ProviderConfig | null): string {
    const firstModelId = provider?.models?.map((item) => getProviderModelId(item)).find(Boolean)
    return firstModelId ? `${providerId}/${firstModelId}` : providerId
}

export interface ValidationError {
    field: string
    message: string
}

export interface ValidationResult {
    valid: boolean
    errors: ValidationError[]
}

export interface ProviderInfo {
    id: string
    name: string
    api: string
    has_api_key: boolean
    is_default: boolean
}

function normalizeProviderConfig(provider: ProviderConfig): ProviderConfig {
    const normalized: ProviderConfig = { ...provider }

    const apiKey = provider.apiKey ?? provider.api_key
    const baseUrl = provider.baseUrl ?? provider.base_url

    delete normalized.apiKey
    delete normalized.baseUrl

    if (apiKey !== undefined) normalized.api_key = apiKey
    if (baseUrl !== undefined) normalized.base_url = baseUrl

    return normalized
}

function normalizeConfigForWrite(config: OpenclawConfig): OpenclawConfig {
    const next: OpenclawConfig = {
        ...config,
    }

    if (config.models?.providers) {
        next.models = {
            ...config.models,
            providers: Object.fromEntries(
                Object.entries(config.models.providers).map(([id, provider]) => [
                    id,
                    normalizeProviderConfig(provider),
                ])
            ),
        }
    }

    return next
}

export const configApi = {
    read: () => invoke<OpenclawConfig>('read_config'),
    write: (config: OpenclawConfig) =>
        invoke('write_config', { config: normalizeConfigForWrite(config) }),
    validate: (jsonStr: string) => invoke<ValidationResult>('validate_config_json', { jsonStr }),
    reloadGateway: () => invoke<string>('reload_gateway'),
    getProviders: () => invoke<ProviderInfo[]>('get_providers'),
    setDefaultProvider: (providerId: string) => invoke('set_default_provider', { providerId }),
}

// Agent 管理
export interface Agent {
    id: string
    name?: string
    workspace?: string
    model?: {
        primary?: string
    }
}

export interface AgentFiles {
    system?: string
    tools?: string
    rules?: string
    models?: string
    auth_profiles?: string
}

export const agentApi = {
    list: () => invoke<Agent[]>('list_agents'),
    create: (name: string, workspace: string, model?: string) =>
        invoke<Agent>('create_agent', { name, workspace, model }),
    readFiles: (agentId: string) =>
        invoke<AgentFiles>('read_agent_files', { agentId }),
    writeFile: (agentId: string, filename: string, content: string) =>
        invoke('write_agent_file', { agentId, filename, content }),
    delete: (agentId: string) => invoke('delete_agent', { agentId }),
    readWorkspaceFile: (workspace: string, filename: string) =>
        invoke<string>('read_workspace_file', { workspace, filename }),
    writeWorkspaceFile: (workspace: string, filename: string, content: string) =>
        invoke('write_workspace_file', { workspace, filename, content }),
    generateConfigAI: (
        description: string,
        apiKey: string,
        provider: string,
        baseUrl: string,
        model: string | undefined,
        onStream: (chunk: StreamChunk) => void,
        onComplete: (content: string) => void,
        onError?: (message: string) => void
    ) => {
        const unlistenStream = listen<StreamChunk>('agent-config-stream', (event) => {
            onStream(event.payload)
        })

        const unlistenComplete = listen<string>('agent-config-complete', (event) => {
            onComplete(event.payload)
        })

        const unlistenError = listen<string>('agent-config-error', (event) => {
            onError?.(event.payload)
        })

        invoke('generate_agent_config_ai', {
            description,
            apiKey,
            provider,
            baseUrl,
            model,
        })

        return Promise.all([unlistenStream, unlistenComplete, unlistenError]).then(([ul1, ul2, ul3]) => () => {
            ul1()
            ul2()
            ul3()
        })
    },
}

// 技能管理
export interface Skill {
    name: string
    description?: string
    category?: string
    source: 'local' | 'clawhub' | 'recommended'
    version?: string
    author?: string
}

export interface StreamChunk {
    content: string
    done: boolean
}

export const skillApi = {
    listLocal: () => invoke<Skill[]>('list_local_skills'),
    searchClawHub: (query: string, limit: number) =>
        invoke<Skill[]>('search_clawhub', { query, limit }),
    recommend: (query: string, apiKey: string, provider: string, baseUrl: string, model?: string) =>
        invoke<Skill[]>('recommend_skills', { query, apiKey, provider, baseUrl, model }),
    recommendStream: (
        query: string,
        apiKey: string,
        provider: string,
        baseUrl: string,
        onChunk: (chunk: StreamChunk) => void
    ) => {
        // 监听流式事件
        const unlisten = listen<StreamChunk>('ai-stream', (event) => {
            onChunk(event.payload)
        })

        // 调用流式推荐命令
        invoke('recommend_skills_stream', {
            query,
            apiKey,
            provider,
            baseUrl,
        })

        return unlisten
    },
    install: (workspacePath: string, skillSlug: string) =>
        invoke('install_skill', { workspacePath, skillSlug }),
    installStream: (
        workspacePath: string,
        skillSlug: string,
        onLog: (log: string) => void,
        onComplete: (success: boolean) => void
    ) => {
        const unlistenLog = listen<string>('skill-install-log', (event) => {
            onLog(event.payload)
        })

        const unlistenComplete = listen<boolean>('skill-install-complete', (event) => {
            onComplete(event.payload)
        })

        invoke('install_skill_stream', { workspacePath, skillSlug })

        return Promise.all([unlistenLog, unlistenComplete]).then(([ul1, ul2]) => () => {
            ul1()
            ul2()
        })
    },
    listAgentSkills: (workspacePath: string) =>
        invoke<Skill[]>('list_agent_skills', { workspacePath }),
    listBuiltin: () => invoke<Skill[]>('list_builtin_skills'),
}

// 环境工具
export interface EnvToolCheckResult {
    found: boolean
    version?: string
}

export const envToolApi = {
    check: (tool: string) =>
        invoke<EnvToolCheckResult>('check_env_tool', { tool }),
    install: (tool: string) => invoke('install_env_tool', { tool }),
    uninstall: (tool: string) => invoke('uninstall_env_tool', { tool }),
    onInstallLog: (callback: (log: string) => void) =>
        listen<string>('install-log', (event) => callback(event.payload)),
    onInstallProgress: (callback: (progress: number) => void) =>
        listen<number>('install-progress', (event) => callback(event.payload)),
}

// SSH 连接
export interface SshConfig {
    host: string
    port: number
    username: string
    auth_method: {
        type: 'password' | 'privatekey'
        password?: string
        key_path?: string
    }
}

export interface CommandOutput {
    stdout: string
    stderr: string
    exit_code: number
    success: boolean
}

export const sshApi = {
    testConnection: (config: SshConfig) =>
        invoke<boolean>('test_ssh_connection', { config }),
    executeCommand: (config: SshConfig, command: string) =>
        invoke<CommandOutput>('execute_ssh_command', { config, command }),
    uploadFile: (config: SshConfig, localPath: string, remotePath: string) =>
        invoke('upload_ssh_file', { config, localPath, remotePath }),
}

// 系统 API
export const systemApi = {
    pickFolder: () => invoke<string | null>('pick_folder'),
    openPathInFinder: (path: string) =>
        invoke('open_path_in_finder', { path }),
}

// ClawHub API
export interface ClawHubSearchItem {
    slug: string
    display_name?: string
    name?: string
    score?: number
    summary?: string
}

export interface ClawHubBrowseResult {
    items: ClawHubSearchItem[]
    nextCursor?: string
}

export const clawhubApi = {
    search: (query: string, limit: number) =>
        invoke<Skill[]>('search_clawhub_skills', { query, limit }),
    browse: (cursor?: string, sort?: string) =>
        invoke<ClawHubBrowseResult>('browse_clawhub_skills', { cursor, sort }),
}

// Mind 团队房间
export interface Room {
    id: string
    title: string
    created_at: number
    project_path?: string
    agent_ids?: string[]
}

export interface Message {
    id: string
    room_id: string
    sender_type: 'human' | 'agent' | 'system'
    sender_id: string
    content: string
    created_at: number
    status?: string
}

export interface MindTask {
    id: string
    room_id: string
    title: string
    description: string
    assignees: string[]
    status: 'todo' | 'in_progress' | 'done' | 'blocked'
    created_at: number
    updated_at: number
}

export const mindApi = {
    listRooms: () => invoke<Room[]>('list_rooms'),
    createRoom: (title: string, projectPath?: string) =>
        invoke<Room>('create_room', { title, projectPath }),
    listMessages: (roomId: string) => invoke<Message[]>('list_messages', { roomId }),
    appendMessage: (
        roomId: string,
        senderType: string,
        senderId: string,
        content: string
    ) =>
        invoke<Message>('append_message', {
            roomId,
            senderType,
            senderId,
            content,
        }),
    invokeAgent: (roomId: string, agentId: string) =>
        invoke<Message>('invoke_agent', { roomId, agentId }),
    listTasks: (roomId: string) => invoke<MindTask[]>('list_tasks', { roomId }),
    createTask: (
        roomId: string,
        title: string,
        description: string,
        assignees: string[]
    ) =>
        invoke<MindTask>('create_task', {
            roomId,
            title,
            description,
            assignees,
        }),
    updateTaskStatus: (taskId: string, status: string) =>
        invoke<MindTask>('update_task_status', { taskId, status }),
    updateRoomAgents: (roomId: string, agentIds: string[]) =>
        invoke<Room>('update_room_agents', { roomId, agentIds }),
    updateRoomProjectPath: (roomId: string, projectPath?: string) =>
        invoke<Room>('update_room_project_path', { roomId, projectPath }),
}
