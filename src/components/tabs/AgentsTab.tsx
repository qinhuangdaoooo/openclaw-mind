'use client'

import { useState, useEffect, useCallback } from 'react'
import { agentApi, Agent, configApi } from '@/lib/tauri'
import AIConfigGenerator from '@/components/agent/AIConfigGenerator'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

// Sub-tab type
type AgentSubTab = 'manage' | 'bindings' | 'collab'

interface AgentFiles {
    soul: string
    agentsMd: string
    memory: string
}

type ActiveTab = 'soul' | 'agents' | 'memory'

interface AgentState {
    files: AgentFiles
    tab: ActiveTab
    saving: boolean
    loading: boolean
    saveError: string | null
    saved: boolean
}

const DEFAULT_WORKSPACE = '~/.openclaw/workspace'

function defaultWorkspacePath(name: string): string {
    return name.trim() ? `~/.openclaw/workspace-${name.trim()}` : ''
}

export default function AgentsTab() {
    const [subTab, setSubTab] = useState<AgentSubTab>('manage')
    const [agents, setAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [newAgentName, setNewAgentName] = useState('')
    const [newAgentWorkspace, setNewAgentWorkspace] = useState('')
    const [newAgentModel, setNewAgentModel] = useState('')
    const [workspaceTouched, setWorkspaceTouched] = useState(false)
    const [creating, setCreating] = useState(false)
    const [createLog, setCreateLog] = useState('')
    const [createSuccess, setCreateSuccess] = useState<boolean | null>(null)
    const [showCreateLog, setShowCreateLog] = useState(false)
    const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>({})
    const [agentStates, setAgentStates] = useState<Record<string, AgentState>>({})
    const [aiGeneratorWorkspace, setAiGeneratorWorkspace] = useState<string | null>(null)
    const [providers, setProviders] = useState<Array<{ id: string; name: string; isDefault: boolean }>>([])
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; workspace: string } | null>(null)

    const reloadAgentWorkspaceFiles = useCallback(
        async (agentId: string, workspace: string) => {
            setAgentStates((prev) => ({
                ...prev,
                [agentId]: {
                    ...(prev[agentId] ?? {
                        files: { soul: '', agentsMd: '', memory: '' },
                        tab: 'soul' as const,
                        saving: false,
                        loading: false,
                        saveError: null,
                        saved: false,
                    }),
                    loading: true,
                    saveError: null,
                },
            }))

            try {
                const soul = await agentApi.readWorkspaceFile(workspace, 'SOUL.md')
                const agentsMd = await agentApi.readWorkspaceFile(workspace, 'AGENTS.md')
                const memory = await agentApi.readWorkspaceFile(workspace, 'MEMORY.md')

                setAgentStates((prev) => ({
                    ...prev,
                    [agentId]: {
                        ...prev[agentId],
                        files: { soul, agentsMd, memory },
                        loading: false,
                    },
                }))
            } catch (err) {
                setAgentStates((prev) => ({
                    ...prev,
                    [agentId]: {
                        ...prev[agentId],
                        loading: false,
                        saveError: String(err),
                    },
                }))
            }
        },
        []
    )

    useEffect(() => {
        loadAgents()
        loadProviders()
    }, [])

    const loadProviders = async () => {
        try {
            const providerList = await configApi.getProviders()
            console.log('Loaded providers:', providerList)
            setProviders(providerList.map(p => ({ id: p.id, name: p.name, isDefault: p.is_default })))
            // 设置默认模型
            const defaultProvider = providerList.find(p => p.is_default)
            if (defaultProvider) {
                setNewAgentModel(defaultProvider.id)
            }
        } catch (err) {
            console.error('Failed to load providers:', err)
            console.error('Error type:', typeof err)
            console.error('Error details:', JSON.stringify(err, null, 2))
            // 即使失败也设置空数组，避免阻塞
            setProviders([])
        }
    }

    const loadAgents = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            console.log('Loading agents...')
            const list = await agentApi.list()
            console.log('Agents loaded:', list)
            // 确保 main 排在第一位
            list.sort((a, b) => {
                if (a.id === 'main') return -1
                if (b.id === 'main') return 1
                return a.id.localeCompare(b.id)
            })
            setAgents(list)
        } catch (err) {
            console.error('Failed to load agents:', err)
            setError(String(err))
        } finally {
            setLoading(false)
        }
    }, [])

    const handleCreateAgent = async () => {
        const name = newAgentName.trim()
        if (!name) {
            setError('请填写 Agent 名称')
            return
        }

        const ws = newAgentWorkspace.trim() || defaultWorkspacePath(name)
        const model = newAgentModel.trim() || undefined
        setCreating(true)
        setCreateSuccess(null)
        setShowCreateLog(true)
        setCreateLog(`创建 Agent: ${name}\n工作区: ${ws}\n${model ? `模型: ${model}\n` : ''}\n`)

        try {
            await agentApi.create(name, ws, model)
            setCreateLog((prev) => prev + `✓ Agent "${name}" 创建成功\n`)
            setCreateSuccess(true)
            setNewAgentName('')
            setNewAgentWorkspace('')
            setNewAgentModel('')
            setWorkspaceTouched(false)
            await loadAgents()
        } catch (err) {
            setCreateLog((prev) => prev + `✗ 创建失败: ${String(err)}\n`)
            setCreateSuccess(false)
            setError(String(err))
        } finally {
            setCreating(false)
        }
    }

    const handleToggleExpand = async (id: string) => {
        const nowExpanded = !expandedAgents[id]
        setExpandedAgents((prev) => ({ ...prev, [id]: nowExpanded }))

        if (nowExpanded && !agentStates[id]) {
            const agent = agents.find((a) => a.id === id)
            const workspace = agent?.workspace || DEFAULT_WORKSPACE

            setAgentStates((prev) => ({
                ...prev,
                [id]: {
                    files: { soul: '', agentsMd: '', memory: '' },
                    tab: 'soul',
                    saving: false,
                    loading: true,
                    saveError: null,
                    saved: false,
                },
            }))

            try {
                // 读取工作区文件
                const soul = await agentApi.readWorkspaceFile(workspace, 'SOUL.md')
                const agentsMd = await agentApi.readWorkspaceFile(workspace, 'AGENTS.md')
                const memory = await agentApi.readWorkspaceFile(workspace, 'MEMORY.md')

                setAgentStates((prev) => ({
                    ...prev,
                    [id]: { ...prev[id], files: { soul, agentsMd, memory }, loading: false },
                }))
            } catch (err) {
                setAgentStates((prev) => ({
                    ...prev,
                    [id]: { ...prev[id], loading: false, saveError: String(err) },
                }))
            }
        }
    }

    const updateAgentFile = (id: string, field: keyof AgentFiles, value: string) => {
        setAgentStates((prev) => ({
            ...prev,
            [id]: {
                ...prev[id],
                files: { ...prev[id].files, [field]: value },
                saved: false,
                saveError: null,
            },
        }))
    }

    const setAgentTab = (id: string, tab: ActiveTab) => {
        setAgentStates((prev) => ({ ...prev, [id]: { ...prev[id], tab } }))
    }

    const handleSaveAgent = async (id: string) => {
        const state = agentStates[id]
        if (!state || state.saving) return

        const agent = agents.find((a) => a.id === id)
        const workspace = agent?.workspace || DEFAULT_WORKSPACE

        setAgentStates((prev) => ({
            ...prev,
            [id]: { ...prev[id], saving: true, saveError: null, saved: false },
        }))

        try {
            // 写入工作区文件
            await agentApi.writeWorkspaceFile(workspace, 'SOUL.md', state.files.soul)
            await agentApi.writeWorkspaceFile(workspace, 'AGENTS.md', state.files.agentsMd)
            if (state.files.memory.trim()) {
                await agentApi.writeWorkspaceFile(workspace, 'MEMORY.md', state.files.memory)
            }

            setAgentStates((prev) => ({
                ...prev,
                [id]: { ...prev[id], saving: false, saved: true },
            }))

            setTimeout(() => {
                setAgentStates((prev) => ({ ...prev, [id]: { ...prev[id], saved: false } }))
            }, 3000)
        } catch (err) {
            setAgentStates((prev) => ({
                ...prev,
                [id]: { ...prev[id], saving: false, saveError: String(err) },
            }))
        }
    }

    const handleDeleteAgent = (id: string, workspace: string) => {
        setDeleteTarget({ id, workspace })
    }

    const updateAgentModel = useCallback(
        async (agentId: string, providerId: string) => {
            try {
                const config = await configApi.read()
                if (!config.agents?.list) return
                const list = config.agents.list
                const idx = list.findIndex((a) => a.id === agentId)
                if (idx === -1) return
                if (!list[idx].model) list[idx] = { ...list[idx], model: { primary: undefined } }
                list[idx] = {
                    ...list[idx],
                    model: { primary: providerId.trim() || undefined },
                }
                await configApi.write(config)
                await loadAgents()
            } catch (err) {
                setError(String(err))
            }
        },
        [loadAgents]
    )

    return (
        <div className="flex-1 flex flex-col h-full">
            {/* Sub-navigation */}
            <nav className="flex items-center px-6 border-b border-gray-700 shrink-0 gap-6 bg-gray-800/30">
                {[
                    { id: 'manage' as const, label: 'Agent 管理', icon: '🤖' },
                    { id: 'bindings' as const, label: '路由绑定', icon: '🔀' },
                    { id: 'collab' as const, label: '多 Agent 协作', icon: '🔗' },
                ].map((item) => {
                    const isActive = subTab === item.id
                    return (
                        <button
                            key={item.id}
                            onClick={() => setSubTab(item.id)}
                            className={`relative flex items-center gap-1.5 py-3.5 text-sm font-medium transition-colors whitespace-nowrap ${isActive ? 'text-white' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <span className={isActive ? 'text-blue-400' : ''}>{item.icon}</span>
                            {item.label}
                            {isActive && (
                                <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-blue-500" />
                            )}
                        </button>
                    )
                })}
            </nav>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
                {subTab === 'manage' && <AgentManageContent
                    agents={agents}
                    loading={loading}
                    error={error}
                    newAgentName={newAgentName}
                    newAgentWorkspace={newAgentWorkspace}
                    newAgentModel={newAgentModel}
                    providers={providers}
                    workspaceTouched={workspaceTouched}
                    creating={creating}
                    createLog={createLog}
                    createSuccess={createSuccess}
                    showCreateLog={showCreateLog}
                    expandedAgents={expandedAgents}
                    agentStates={agentStates}
                    setNewAgentName={setNewAgentName}
                    setNewAgentWorkspace={setNewAgentWorkspace}
                    setNewAgentModel={setNewAgentModel}
                    setWorkspaceTouched={setWorkspaceTouched}
                    setShowCreateLog={setShowCreateLog}
                    handleCreateAgent={handleCreateAgent}
                    handleToggleExpand={handleToggleExpand}
                    handleDeleteAgent={handleDeleteAgent}
                    updateAgentModel={updateAgentModel}
                    updateAgentFile={updateAgentFile}
                    setAgentTab={setAgentTab}
                    handleSaveAgent={handleSaveAgent}
                    loadAgents={loadAgents}
                    onOpenAIGenerator={(workspace) => setAiGeneratorWorkspace(workspace)}
                />}
                {subTab === 'bindings' && <AgentBindingsContent />}
                {subTab === 'collab' && <AgentCollabContent />}
            </div>

            {/* AI Config Generator Dialog */}
            {aiGeneratorWorkspace && (
                <AIConfigGenerator
                    workspace={aiGeneratorWorkspace}
                    onClose={() => setAiGeneratorWorkspace(null)}
                    onSuccess={() => {
                        // 应用配置后：确保界面重新读取工作区文件（不依赖展开/收起）
                        const agent = agents.find((a) => a.workspace === aiGeneratorWorkspace)
                        if (agent?.id) {
                            setExpandedAgents((prev) => ({ ...prev, [agent.id]: true }))
                            reloadAgentWorkspaceFiles(agent.id, aiGeneratorWorkspace)
                        }
                    }}
                />
            )}

            {/* Delete Agent Confirm Dialog */}
            <ConfirmDialog
                open={!!deleteTarget}
                title="删除 Agent"
                description={
                    deleteTarget && (
                        <div className="space-y-2">
                            <p>确认删除 Agent「{deleteTarget.id}」？</p>
                            <p className="text-gray-400 text-[11px] leading-relaxed">
                                工作区目录
                                <span className="font-mono mx-1 text-gray-200">
                                    {deleteTarget.workspace}
                                </span>
                                不会被删除，此操作不可撤销。
                            </p>
                        </div>
                    )
                }
                confirmLabel="确认删除"
                cancelLabel="取消"
                danger
                onCancel={() => setDeleteTarget(null)}
                onConfirm={async () => {
                    if (!deleteTarget) return
                    const { id, workspace } = deleteTarget
                    try {
                        await agentApi.delete(id)
                        setExpandedAgents((prev) => {
                            const next = { ...prev }
                            delete next[id]
                            return next
                        })
                        setAgentStates((prev) => {
                            const next = { ...prev }
                            delete next[id]
                            return next
                        })
                        await loadAgents()
                    } catch (err) {
                        setError(String(err))
                    } finally {
                        setDeleteTarget(null)
                    }
                }}
            />
        </div>
    )
}

// Agent Manage Content Component
interface AgentManageContentProps {
    agents: Agent[]
    loading: boolean
    error: string | null
    newAgentName: string
    newAgentWorkspace: string
    newAgentModel: string
    providers: Array<{ id: string; name: string; isDefault: boolean }>
    workspaceTouched: boolean
    creating: boolean
    createLog: string
    createSuccess: boolean | null
    showCreateLog: boolean
    expandedAgents: Record<string, boolean>
    agentStates: Record<string, AgentState>
    setNewAgentName: (name: string) => void
    setNewAgentWorkspace: (workspace: string) => void
    setNewAgentModel: (model: string) => void
    setWorkspaceTouched: (touched: boolean) => void
    setShowCreateLog: (show: boolean) => void
    handleCreateAgent: () => void
    handleToggleExpand: (id: string) => void
    handleDeleteAgent: (id: string, workspace: string) => void
    updateAgentModel: (agentId: string, providerId: string) => void
    updateAgentFile: (id: string, field: keyof AgentFiles, value: string) => void
    setAgentTab: (id: string, tab: ActiveTab) => void
    handleSaveAgent: (id: string) => void
    loadAgents: () => void
    onOpenAIGenerator: (workspace: string) => void
}

function AgentManageContent(props: AgentManageContentProps) {
    const {
        agents,
        loading,
        error,
        newAgentName,
        newAgentWorkspace,
        newAgentModel,
        providers,
        workspaceTouched,
        creating,
        createLog,
        createSuccess,
        showCreateLog,
        expandedAgents,
        agentStates,
        setNewAgentName,
        setNewAgentWorkspace,
        setNewAgentModel,
        setWorkspaceTouched,
        setShowCreateLog,
        handleCreateAgent,
        handleToggleExpand,
        handleDeleteAgent,
        updateAgentModel,
        updateAgentFile,
        setAgentTab,
        handleSaveAgent,
        loadAgents,
        onOpenAIGenerator,
    } = props

    return (
        <div className="flex-1 p-6">
            <div className="max-w-4xl mx-auto space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-white mb-1">Agent 管理</h1>
                        <p className="text-xs text-gray-400">
                            创建、配置独立 Agent，每个 Agent 拥有独立的记忆、身份与工作区
                        </p>
                    </div>
                    <button
                        onClick={loadAgents}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors disabled:opacity-40"
                    >
                        <span className={loading ? 'animate-spin' : ''}>🔄</span>
                        刷新列表
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                {/* Create Agent Form */}
                <FormSection
                    title="创建 Agent"
                    description="新建独立 Agent，每个 Agent 有专属工作区与身份文件，互不干扰"
                >
                    <div className="space-y-3">
                        {/* Agent Name */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400">Agent 名称</label>
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-600 font-mono select-none pointer-events-none">
                                        agents add&nbsp;
                                    </span>
                                    <input
                                        type="text"
                                        value={newAgentName}
                                        onChange={(e) => {
                                            const v = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '')
                                            setNewAgentName(v)
                                            if (!workspaceTouched) setNewAgentWorkspace(defaultWorkspacePath(v))
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleCreateAgent()
                                        }}
                                        placeholder="tech-agent"
                                        disabled={creating}
                                        className="w-full pl-20 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500 disabled:opacity-50"
                                    />
                                </div>
                                <button
                                    onClick={handleCreateAgent}
                                    disabled={!newAgentName.trim() || creating}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {creating ? (
                                        <span className="animate-spin">⏳</span>
                                    ) : (
                                        <span>➕</span>
                                    )}
                                    创建
                                </button>
                            </div>
                            <p className="text-xs text-gray-500">
                                仅支持字母、数字、下划线和短横线，例如：
                                <code className="font-mono ml-1">tech-agent</code>、
                                <code className="font-mono ml-1">ops_bot</code>
                            </p>
                        </div>

                        {/* Workspace */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400">
                                工作目录{' '}
                                <span className="text-gray-600 font-normal">(--workspace，可选)</span>
                            </label>
                            <input
                                type="text"
                                value={newAgentWorkspace}
                                onChange={(e) => {
                                    setNewAgentWorkspace(e.target.value)
                                    setWorkspaceTouched(true)
                                }}
                                placeholder={
                                    newAgentName.trim()
                                        ? defaultWorkspacePath(newAgentName)
                                        : '~/.openclaw/workspace-<name>'
                                }
                                disabled={creating}
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-blue-500 disabled:opacity-50"
                            />
                            <p className="text-xs text-gray-500">
                                SOUL.md、AGENTS.md 将写入此目录；留空使用默认路径：
                                <code className="font-mono ml-1">
                                    ~/.openclaw/workspace-{newAgentName || '<name>'}
                                </code>
                            </p>
                        </div>

                        {/* Model Selection */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400">
                                模型提供商{' '}
                                <span className="text-gray-600 font-normal">(可选，留空使用默认)</span>
                            </label>
                            <select
                                value={newAgentModel}
                                onChange={(e) => setNewAgentModel(e.target.value)}
                                disabled={creating}
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                            >
                                <option value="">使用默认模型</option>
                                {providers.map((provider) => (
                                    <option key={provider.id} value={provider.id}>
                                        {provider.name} {provider.isDefault ? '(默认)' : ''}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500">
                                为此 Agent 指定专用模型，留空则使用全局默认模型
                            </p>
                        </div>

                        {/* Terminal Log */}
                        {showCreateLog && (
                            <div className="rounded-lg overflow-hidden border border-gray-700 bg-gray-950">
                                <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900/80 border-b border-gray-800">
                                    <div className="flex items-center gap-2">
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 rounded-full bg-red-500/70" />
                                            <span className="w-2 h-2 rounded-full bg-yellow-500/70" />
                                            <span className="w-2 h-2 rounded-full bg-green-500/70" />
                                        </div>
                                        <span className="text-xs font-mono text-gray-400">终端输出</span>
                                        {creating && (
                                            <span className="flex items-center gap-1 text-xs text-amber-400 font-mono">
                                                <span className="animate-spin">⏳</span>
                                                执行中…
                                            </span>
                                        )}
                                        {!creating && createSuccess === true && (
                                            <span className="text-xs text-emerald-400 font-mono">✓ 成功</span>
                                        )}
                                        {!creating && createSuccess === false && (
                                            <span className="text-xs text-red-400 font-mono">✗ 失败</span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setShowCreateLog(false)}
                                        className="text-xs text-gray-500 hover:text-gray-300 transition font-mono"
                                    >
                                        收起
                                    </button>
                                </div>
                                <pre className="px-3 py-2 text-xs font-mono max-h-44 overflow-y-auto leading-relaxed whitespace-pre-wrap break-all">
                                    {createLog.split('\n').map((line, i) => {
                                        const isOk = /✓|成功|created|added|done/i.test(line)
                                        const isErr = /✗|失败|error|failed/i.test(line)
                                        return (
                                            <span
                                                key={i}
                                                className={
                                                    isOk
                                                        ? 'text-emerald-400'
                                                        : isErr
                                                            ? 'text-red-400'
                                                            : 'text-gray-300'
                                                }
                                            >
                                                {line}
                                                {'\n'}
                                            </span>
                                        )
                                    })}
                                </pre>
                            </div>
                        )}
                    </div>
                </FormSection>

                {/* Agent List */}
                <FormSection
                    title="已有 Agent"
                    description="点击 Agent 展开，可编辑工作区中的 SOUL.md / AGENTS.md / MEMORY.md"
                    action={
                        <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs font-mono rounded">
                            {agents.length} 个
                        </span>
                    }
                >
                    {loading && agents.length === 0 ? (
                        <div className="flex items-center justify-center py-8 gap-2 text-gray-500">
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs">正在读取 Agent 列表…</span>
                        </div>
                    ) : agents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-500">
                            <div className="w-12 h-12 rounded-xl bg-gray-700 flex items-center justify-center">
                                <span className="text-2xl">🤖</span>
                            </div>
                            <p className="text-xs">暂无 Agent，在上方创建第一个</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {agents.map((agent) => {
                                const isExpanded = !!expandedAgents[agent.id]
                                const state = agentStates[agent.id]
                                const workspace = agent.workspace || DEFAULT_WORKSPACE

                                return (
                                    <AgentCard
                                        key={agent.id}
                                        agent={agent}
                                        workspace={workspace}
                                        isExpanded={isExpanded}
                                        state={state}
                                        providers={providers}
                                        onToggle={() => handleToggleExpand(agent.id)}
                                        onDelete={() => handleDeleteAgent(agent.id, workspace)}
                                        onUpdateModel={(providerId) => updateAgentModel(agent.id, providerId)}
                                        onUpdateFile={(field, value) => updateAgentFile(agent.id, field, value)}
                                        onSetTab={(tab) => setAgentTab(agent.id, tab)}
                                        onSave={() => handleSaveAgent(agent.id)}
                                        onOpenAIGenerator={() => onOpenAIGenerator(workspace)}
                                    />
                                )
                            })}
                        </div>
                    )}
                </FormSection>

                {/* Footer Info */}
                <div className="text-xs text-gray-600 flex items-center gap-1.5 pb-2">
                    <span>📁</span>
                    Agent 目录：
                    <code className="font-mono">~/.openclaw/agents/</code>
                    <span className="mx-1 opacity-50">·</span>
                    SOUL.md / AGENTS.md 在各 Agent 的工作区目录下
                </div>
            </div>
        </div>
    )
}

// Agent Bindings Content
function AgentBindingsContent() {
    const [bindings, setBindings] = useState<AgentBinding[]>([])
    const [localAgents, setLocalAgents] = useState<string[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        loadBindings()
        loadLocalAgents()
    }, [])

    const loadBindings = async () => {
        setLoading(true)
        try {
            const config = await configApi.read()
            setBindings(config.bindings || [])
        } catch (err) {
            console.error('Failed to load bindings:', err)
        } finally {
            setLoading(false)
        }
    }

    const loadLocalAgents = async () => {
        try {
            const agents = await agentApi.list()
            setLocalAgents(agents.map(a => a.id))
        } catch (err) {
            console.error('Failed to load agents:', err)
        }
    }

    const addBinding = () => {
        setBindings([
            ...bindings,
            {
                agentId: '',
                match: {
                    channel: 'telegram',
                    peer: { kind: 'group', id: '' }
                }
            }
        ])
    }

    const updateBinding = (index: number, updates: Partial<AgentBinding>) => {
        const newBindings = [...bindings]
        newBindings[index] = { ...newBindings[index], ...updates }
        setBindings(newBindings)
    }

    const removeBinding = (index: number) => {
        setBindings(bindings.filter((_, i) => i !== index))
    }

    const saveBindings = async () => {
        try {
            const config = await configApi.read()
            config.bindings = bindings.filter(b => b.agentId.trim())
            await configApi.write(config)
            alert('路由绑定已保存！')
        } catch (err) {
            alert('保存失败: ' + String(err))
        }
    }

    const hasEmptyAgentId = bindings.some(b => !b.agentId.trim())

    return (
        <div className="flex-1 p-6">
            <div className="max-w-4xl mx-auto space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white">路由绑定</h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            将渠道消息路由至指定 Agent，支持按频道类型、群组 ID 精确匹配
                        </p>
                    </div>
                    <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs font-mono rounded">
                        {bindings.length} 条规则
                    </span>
                </div>

                {/* Warning */}
                {hasEmptyAgentId && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-amber-700/50 bg-amber-900/20 px-4 py-3">
                        <span className="text-amber-400 text-sm shrink-0">⚠️</span>
                        <div className="space-y-0.5">
                            <p className="text-xs font-semibold text-amber-400">存在未完成的绑定规则</p>
                            <p className="text-xs text-amber-400/70">
                                请为每条规则填写 agentId，或删除空规则，否则无法保存。
                            </p>
                        </div>
                    </div>
                )}

                {/* Bindings List */}
                <FormSection
                    title="绑定规则 (bindings)"
                    description="按顺序匹配，第一条命中的规则生效。peer.id 留空表示匹配该类型的所有会话"
                    action={
                        <button
                            onClick={addBinding}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                        >
                            <span>➕</span>
                            添加规则
                        </button>
                    }
                >
                    {loading ? (
                        <div className="flex items-center justify-center py-8 text-gray-500">
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
                            加载中...
                        </div>
                    ) : bindings.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-500">
                            <div className="w-12 h-12 rounded-xl bg-gray-700 flex items-center justify-center">
                                <span className="text-2xl">🔀</span>
                            </div>
                            <p className="text-xs">暂无路由规则，点击右上角「添加规则」</p>
                            <p className="text-xs text-gray-600 text-center max-w-xs">
                                不配置路由时，所有渠道消息将发送给默认 Agent
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {bindings.map((binding, idx) => (
                                <BindingRow
                                    key={idx}
                                    idx={idx}
                                    binding={binding}
                                    localAgents={localAgents}
                                    onUpdate={(updates) => updateBinding(idx, updates)}
                                    onRemove={() => removeBinding(idx)}
                                />
                            ))}
                        </div>
                    )}
                </FormSection>

                {/* Config Preview */}
                {bindings.length > 0 && (
                    <FormSection
                        title="配置预览（已规范化）"
                        description="peer.id 为空时会自动省略，保存后网关可正常启动"
                    >
                        <pre className="text-xs font-mono text-gray-300 bg-gray-900/30 rounded-lg p-3 overflow-x-auto leading-relaxed">
                            {JSON.stringify(
                                {
                                    bindings: bindings
                                        .filter(b => b.agentId.trim())
                                        .map(b => ({
                                            agentId: b.agentId.trim(),
                                            match: {
                                                channel: b.match.channel,
                                                ...(b.match.peer?.id?.trim()
                                                    ? {
                                                        peer: {
                                                            kind: b.match.peer.kind,
                                                            id: b.match.peer.id.trim()
                                                        }
                                                    }
                                                    : {})
                                            }
                                        }))
                                },
                                null,
                                2
                            )}
                        </pre>
                    </FormSection>
                )}

                {/* Save Button */}
                <div className="flex items-center justify-end gap-2 py-3 px-4 rounded-xl border border-gray-700 bg-gray-800/60">
                    <button
                        onClick={saveBindings}
                        disabled={hasEmptyAgentId}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm font-medium transition-colors disabled:opacity-40"
                    >
                        <span>💾</span>
                        保存配置
                    </button>
                </div>
            </div>
        </div>
    )
}

// Binding Row Component
interface BindingRowProps {
    idx: number
    binding: AgentBinding
    localAgents: string[]
    onUpdate: (updates: Partial<AgentBinding>) => void
    onRemove: () => void
}

function BindingRow({ idx, binding, localAgents, onUpdate, onRemove }: BindingRowProps) {
    const CHANNEL_OPTIONS = [
        { value: 'telegram', label: 'Telegram' },
        { value: 'whatsapp', label: 'WhatsApp' },
        { value: 'discord', label: 'Discord' },
        { value: 'slack', label: 'Slack' },
        { value: 'feishu', label: 'Feishu' },
        { value: 'qqbridge', label: 'QQ Bridge' },
        { value: 'lark', label: '飞书 (Lark)' },
        { value: 'wechat', label: '微信 (WeChat)' },
    ]

    const PEER_ID_PLACEHOLDERS: Record<string, string> = {
        telegram: 'chat / group id',
        whatsapp: 'group / user id',
        discord: 'guild / channel id',
        slack: 'channel / user id',
        feishu: 'chat_id / open_id',
        lark: 'chat_id / open_id',
        qqbridge: 'group_id / qq',
        wechat: 'room / contact id',
    }

    const PEER_ID_HINTS: Record<string, string> = {
        feishu: '可填写 chat_id、open_id，或留空匹配全部飞书会话',
        lark: '兼容旧的 Lark 配置；建议新配置改用 feishu',
        qqbridge: '可填写群号或 QQ 号；留空表示接收全部桥接消息',
    }

    const PEER_KIND_OPTIONS = [
        { value: 'private', label: '私聊 (private)' },
        { value: 'group', label: '群组 (group)' },
        { value: 'channel', label: '频道 (channel)' },
    ]

    const peerKind = binding.match.peer?.kind || 'group'
    const peerId = binding.match.peer?.id || ''
    const peerIdPlaceholder = PEER_ID_PLACEHOLDERS[binding.match.channel] ?? 'peer id'
    const peerIdHint = PEER_ID_HINTS[binding.match.channel]

    return (
        <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-800/50 border-b border-gray-700">
                <span className="text-xs font-mono text-gray-500 bg-gray-700/60 px-1.5 py-0.5 rounded">
                    #{idx + 1}
                </span>
                <span className="flex-1 text-xs text-gray-400 font-mono">
                    {binding.agentId ? (
                        <span className="text-white font-semibold">{binding.agentId}</span>
                    ) : (
                        <span className="italic opacity-50">（未设置 Agent）</span>
                    )}
                    {' ← '}
                    <span className="text-sky-400">{binding.match.channel}</span>
                    {binding.match.peer && (
                        <>
                            {' / '}
                            <span className="text-emerald-400">{peerKind}</span>
                            {peerId && (
                                <>
                                    {' / '}
                                    <span className="text-amber-400">{peerId}</span>
                                </>
                            )}
                        </>
                    )}
                </span>
                <button
                    onClick={onRemove}
                    className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded transition-colors"
                >
                    <span>🗑️</span>
                </button>
            </div>

            <div className="p-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {/* Agent ID */}
                <div className="space-y-1.5">
                    <label className="text-xs text-gray-400">agentId</label>
                    {localAgents.length > 0 ? (
                        <select
                            value={binding.agentId || ''}
                            onChange={(e) => onUpdate({ agentId: e.target.value })}
                            className="w-full h-8 px-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                        >
                            <option value="">选择 Agent</option>
                            {localAgents.map(a => (
                                <option key={a} value={a}>{a}</option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type="text"
                            value={binding.agentId}
                            onChange={(e) => onUpdate({ agentId: e.target.value })}
                            placeholder="agent-name"
                            className="w-full h-8 px-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                        />
                    )}
                </div>

                {/* Channel */}
                <div className="space-y-1.5">
                    <label className="text-xs text-gray-400">channel</label>
                    <select
                        value={binding.match.channel}
                        onChange={(e) => onUpdate({ match: { ...binding.match, channel: e.target.value } })}
                        className="w-full h-8 px-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500"
                    >
                        {CHANNEL_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>

                {/* Peer Kind */}
                <div className="space-y-1.5">
                    <label className="text-xs text-gray-400">peer.kind</label>
                    <select
                        value={peerKind}
                        onChange={(e) => onUpdate({
                            match: {
                                ...binding.match,
                                peer: { ...binding.match.peer, kind: e.target.value as any, id: peerId }
                            }
                        })}
                        className="w-full h-8 px-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500"
                    >
                        {PEER_KIND_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>

                {/* Peer ID */}
                <div className="space-y-1.5">
                    <label className="text-xs text-gray-400">peer.id（可选）</label>
                    <input
                        type="text"
                        value={peerId}
                        onChange={(e) => onUpdate({
                            match: {
                                ...binding.match,
                                peer: { ...binding.match.peer, kind: peerKind as any, id: e.target.value }
                            }
                        })}
                        placeholder={peerIdPlaceholder}
                        className="w-full h-8 px-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                    />
                    {peerIdHint && (
                        <p className="text-[11px] text-gray-500 leading-relaxed">{peerIdHint}</p>
                    )}
                </div>
            </div>
        </div>
    )
}

// Types
interface AgentBinding {
    agentId: string
    match: {
        channel: string
        peer?: {
            kind: 'private' | 'group' | 'channel'
            id: string
        }
    }
}

// Agent Collab Content
function AgentCollabContent() {
    const [mounted, setMounted] = useState(false)
    const [localAgents, setLocalAgents] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [enabled, setEnabled] = useState(false)
    const [allowList, setAllowList] = useState<string[]>([])
    const [manualInput, setManualInput] = useState('')

    useEffect(() => {
        setMounted(true)
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            // Load config
            const config = await configApi.read()
            const a2a = config.tools?.agentToAgent
            setEnabled(a2a?.enabled ?? false)
            setAllowList(a2a?.allow ?? [])

            // Load local agents
            const agents = await agentApi.list()
            setLocalAgents(agents.map(a => a.id))
        } catch (err) {
            console.error('Failed to load collab config:', err)
        } finally {
            setLoading(false)
        }
    }

    const toggleAgent = (name: string) => {
        if (allowList.includes(name)) {
            setAllowList(allowList.filter(a => a !== name))
        } else {
            setAllowList([...allowList, name])
        }
    }

    const selectAll = () => setAllowList([...localAgents])
    const clearAll = () => setAllowList([])

    const addManualAgent = () => {
        const name = manualInput.trim().replace(/[^a-zA-Z0-9_-]/g, '')
        if (name && !allowList.includes(name)) {
            setAllowList([...allowList, name])
            setManualInput('')
        }
    }

    const removeManualAgent = (name: string) => {
        setAllowList(allowList.filter(a => a !== name))
    }

    const saveConfig = async () => {
        try {
            const config = await configApi.read()
            if (!config.tools) config.tools = {}
            config.tools.agentToAgent = {
                enabled,
                allow: allowList.filter(a => a.trim())
            }
            await configApi.write(config)
            alert('多 Agent 协作配置已保存！')
        } catch (err) {
            alert('保存失败: ' + String(err))
        }
    }

    const extraAgents = allowList.filter(a => !localAgents.includes(a))

    if (!mounted || loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
                <span className="text-xs text-gray-400">加载中...</span>
            </div>
        )
    }

    return (
        <div className="flex-1 p-6">
            <div className="max-w-4xl mx-auto space-y-4">
                {/* Header */}
                <div>
                    <h2 className="text-lg font-bold text-white">多 Agent 协作</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                        开启 Agent 间消息传递，允许 Agent 互相发消息、分配任务
                    </p>
                </div>

                {/* Enable Toggle */}
                <FormSection
                    title="Agent 间通信 (tools.agentToAgent)"
                    description="启用后，允许列表中的 Agent 可以互相发送消息，实现任务委派与多 Agent 协作"
                >
                    <div className="space-y-4">
                        <div className="flex items-center justify-between py-1">
                            <div className="space-y-0.5">
                                <p className="text-sm font-medium text-white">启用 Agent 间通信</p>
                                <p className="text-xs text-gray-500">
                                    对应配置项：
                                    <code className="font-mono bg-gray-700/60 px-1 rounded ml-1">
                                        tools.agentToAgent.enabled
                                    </code>
                                </p>
                            </div>
                            <button
                                onClick={() => setEnabled(!enabled)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-700'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>

                        {enabled && (
                            <div className="rounded-xl border border-gray-700 overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800/50 border-b border-gray-700">
                                    <div>
                                        <p className="text-xs font-semibold text-white">允许通信的 Agent 列表 (allow)</p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            勾选可互相发送消息的 Agent；留空表示允许所有 Agent
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={selectAll}
                                            disabled={localAgents.length === 0}
                                            className="text-xs h-7 px-2 text-gray-300 hover:text-white disabled:opacity-40 transition-colors"
                                        >
                                            全选
                                        </button>
                                        <button
                                            onClick={clearAll}
                                            disabled={allowList.length === 0}
                                            className="text-xs h-7 px-2 text-gray-300 hover:text-white disabled:opacity-40 transition-colors"
                                        >
                                            清空
                                        </button>
                                    </div>
                                </div>

                                <div className="p-3">
                                    {localAgents.length === 0 ? (
                                        <div className="flex flex-col items-center gap-2 py-6 text-gray-500">
                                            <span className="text-3xl">🔗</span>
                                            <p className="text-xs">暂无本地 Agent</p>
                                            <p className="text-xs text-gray-600">
                                                请先在「Agent 管理」页面创建 Agent，或手动输入 Agent 名称
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                            {localAgents.map((name) => {
                                                const isChecked = allowList.includes(name)
                                                return (
                                                    <button
                                                        key={name}
                                                        onClick={() => toggleAgent(name)}
                                                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all ${isChecked
                                                            ? 'border-blue-500/40 bg-blue-500/5 text-white'
                                                            : 'border-gray-700 bg-gray-800 hover:border-blue-500/20 hover:bg-gray-700/30 text-gray-400'
                                                            }`}
                                                    >
                                                        <div
                                                            className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${isChecked
                                                                ? 'bg-blue-600 border-blue-600'
                                                                : 'border-gray-600'
                                                                }`}
                                                        >
                                                            {isChecked && (
                                                                <svg
                                                                    viewBox="0 0 8 8"
                                                                    fill="none"
                                                                    stroke="white"
                                                                    strokeWidth="1.5"
                                                                    className="w-2.5 h-2.5"
                                                                >
                                                                    <polyline points="1,4 3,6 7,2" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                        <span className="text-xs font-mono font-medium flex-1 truncate">
                                                            {name}
                                                        </span>
                                                        {isChecked && <span className="text-blue-400 shrink-0">⚡</span>}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}

                                    {/* Manual Entry */}
                                    <div className="mt-3 pt-3 border-t border-gray-700/50">
                                        <p className="text-xs text-gray-500 mb-2">
                                            手动添加不在本地目录中的 Agent 名称：
                                        </p>

                                        {extraAgents.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mb-2">
                                                {extraAgents.map((name) => (
                                                    <span
                                                        key={name}
                                                        onClick={() => removeManualAgent(name)}
                                                        className="inline-flex items-center gap-1 font-mono text-xs bg-gray-700 border border-gray-600 px-2 py-0.5 rounded cursor-pointer hover:border-red-500/50 hover:text-red-400 transition-colors"
                                                    >
                                                        {name}
                                                        <span className="text-gray-500">×</span>
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2">
                                            <input
                                                value={manualInput}
                                                onChange={(e) => setManualInput(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                                                onKeyDown={(e) => e.key === 'Enter' && addManualAgent()}
                                                placeholder="agent-name，按 Enter 添加"
                                                className="flex-1 h-7 rounded-md border border-gray-700 bg-gray-900 px-2.5 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                                            />
                                            <button
                                                onClick={addManualAgent}
                                                disabled={!manualInput.trim()}
                                                className="h-7 text-xs px-2.5 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-40 transition-colors"
                                            >
                                                添加
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </FormSection>

                {/* Info Box */}
                <div className="rounded-xl border border-sky-700/40 bg-sky-950/20 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="text-sky-400">ℹ️</span>
                        <p className="text-xs font-semibold text-sky-300">配置说明</p>
                    </div>
                    <div className="text-xs text-sky-300/70 space-y-1.5 leading-relaxed">
                        <p>
                            开启后，以下配置将写入{' '}
                            <code className="font-mono bg-sky-900/40 px-1 rounded">openclaw.json</code>
                            ：
                        </p>
                        <pre className="font-mono bg-sky-900/30 rounded-lg p-2.5 text-xs overflow-x-auto">
                            {`{
  "tools": {
    "agentToAgent": {
      "enabled": true,
      "allow": ["agent-a", "agent-b"]
    }
  }
}`}
                        </pre>
                        <p>
                            <code className="font-mono">allow</code> 为空数组时，所有 Agent 都可互相通信；
                            指定列表后，仅列表内的 Agent 可以互发消息。
                        </p>
                    </div>
                </div>

                {/* Config Preview */}
                {enabled && (
                    <FormSection
                        title="配置预览"
                        description="以下内容将写入 openclaw.json 的 tools 字段"
                    >
                        <pre className="text-xs font-mono text-gray-300 bg-gray-900/30 rounded-lg p-3 overflow-x-auto leading-relaxed">
                            {JSON.stringify(
                                {
                                    tools: {
                                        agentToAgent: {
                                            enabled,
                                            allow: allowList.filter(a => a.trim())
                                        }
                                    }
                                },
                                null,
                                2
                            )}
                        </pre>
                    </FormSection>
                )}

                {/* Save Button */}
                <div className="flex items-center justify-end gap-2 py-3 px-4 rounded-xl border border-gray-700 bg-gray-800/60">
                    <button
                        onClick={saveConfig}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                    >
                        <span>💾</span>
                        保存配置
                    </button>
                </div>
            </div>
        </div>
    )
}


// Agent Card Component
interface AgentCardProps {
    agent: Agent
    workspace: string
    isExpanded: boolean
    state?: AgentState
    providers: Array<{ id: string; name: string; isDefault: boolean }>
    onToggle: () => void
    onDelete: () => void
    onUpdateModel: (providerId: string) => void
    onUpdateFile: (field: keyof AgentFiles, value: string) => void
    onSetTab: (tab: ActiveTab) => void
    onSave: () => void
    onOpenAIGenerator: () => void
}

function AgentCard({
    agent,
    workspace,
    isExpanded,
    state,
    providers,
    onToggle,
    onDelete,
    onUpdateModel,
    onUpdateFile,
    onSetTab,
    onSave,
    onOpenAIGenerator,
}: AgentCardProps) {
    const isRegistered = true // TODO: 实现注册状态检测

    return (
        <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
            {/* Card Header */}
            <div
                role="button"
                tabIndex={0}
                onClick={onToggle}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-gray-700/30 transition-colors"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onToggle()
                }}
            >
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <span className="text-sm">🤖</span>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold font-mono text-white">{agent.id}</span>
                        {!isRegistered && (
                            <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-900/20 border border-amber-700/40 px-1.5 py-0.5 rounded-full font-medium">
                                <span>⚠️</span>
                                未注册
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 font-mono truncate mt-0.5">
                        工作区：{workspace}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                        大模型：{agent.model?.primary
                            ? (providers.find((p) => p.id === agent.model?.primary)?.name ?? agent.model?.primary)
                            : '默认'}
                    </p>
                    {isExpanded && (
                        <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs text-gray-500 shrink-0">大模型：</span>
                            <select
                                value={agent.model?.primary ?? ''}
                                onChange={(e) => onUpdateModel(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-6 px-2 rounded bg-gray-700 border border-gray-600 text-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[120px]"
                            >
                                <option value="">使用默认</option>
                                {providers.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} {p.isDefault ? '(默认)' : ''}
                                    </option>
                                ))}
                            </select>
                            <span className="text-[10px] text-gray-600">Mind 群聊回复时使用</span>
                        </div>
                    )}
                </div>

                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        // TODO: 实现打开工作区
                    }}
                    className="text-gray-400 hover:text-white hover:bg-gray-700 p-1.5 rounded transition-colors shrink-0"
                    title="在文件管理器中打开工作区"
                >
                    <span>📁</span>
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onDelete()
                    }}
                    className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded transition-colors shrink-0"
                    title="删除 Agent"
                >
                    <span>🗑️</span>
                </button>
                <span className="text-gray-400 shrink-0">
                    {isExpanded ? '▼' : '▶'}
                </span>
            </div>

            {/* Unregistered Warning */}
            {!isRegistered && isExpanded && (
                <div className="px-4 py-2 bg-amber-900/10 border-t border-amber-700/30">
                    <p className="text-xs text-amber-400">
                        此 Agent 未在 <code className="font-mono">openclaw.json</code> 中注册，路由绑定等功能不可用。
                        建议运行：
                        <code className="font-mono ml-1">
                            openclaw agents add {agent.id} --workspace {workspace}
                        </code>
                    </p>
                </div>
            )}

            {/* Card Body */}
            {isExpanded && (
                <div className="border-t border-gray-700 bg-gray-800/50">
                    {state?.loading ? (
                        <div className="flex items-center justify-center py-8 gap-2 text-gray-500">
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs">正在读取工作区文件…</span>
                        </div>
                    ) : (
                        <div className="p-4 space-y-3">
                            {/* Tab Selector */}
                            <div className="flex items-center gap-1 bg-gray-900/40 rounded-lg p-1 w-fit">
                                {[
                                    { key: 'soul' as const, label: 'SOUL.md', icon: '📝' },
                                    { key: 'agents' as const, label: 'AGENTS.md', icon: '🤖' },
                                    { key: 'memory' as const, label: 'MEMORY.md', icon: '💾' },
                                ].map(({ key, label, icon }) => (
                                    <button
                                        key={key}
                                        onClick={() => onSetTab(key)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${state?.tab === key
                                            ? 'bg-gray-800 text-white shadow-sm'
                                            : 'text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        <span>{icon}</span>
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {/* Editor */}
                            <div className="relative">
                                {state?.tab === 'soul' && (
                                    <AgentFileEditor
                                        filename="SOUL.md"
                                        workspacePath={workspace}
                                        value={state?.files.soul ?? ''}
                                        placeholder={`# SOUL.md\n你是 ${agent.id}，一个专注于……的 AI 助手。\n\n## 核心特征\n- 专业领域\n- 性格特点\n- 回答风格`}
                                        onChange={(v) => onUpdateFile('soul', v)}
                                    />
                                )}
                                {state?.tab === 'agents' && (
                                    <AgentFileEditor
                                        filename="AGENTS.md"
                                        workspacePath={workspace}
                                        value={state?.files.agentsMd ?? ''}
                                        placeholder={`# AGENTS.md\n## ${agent.id} 的职责\n- 负责……\n- 汇报给……\n\n## 工作流程\n1. 接收任务\n2. 执行处理\n3. 返回结果`}
                                        onChange={(v) => onUpdateFile('agentsMd', v)}
                                    />
                                )}
                                {state?.tab === 'memory' && (
                                    <AgentFileEditor
                                        filename="MEMORY.md"
                                        workspacePath={workspace}
                                        value={state?.files.memory ?? ''}
                                        placeholder="# MEMORY.md\n\nAgent 的长期记忆与上下文信息（留空则不创建此文件）"
                                        onChange={(v) => onUpdateFile('memory', v)}
                                    />
                                )}
                            </div>

                            {/* Footer Actions */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 h-7">
                                    {state?.saveError && (
                                        <span className="text-xs text-red-400">{state.saveError}</span>
                                    )}
                                    {state?.saved && (
                                        <span className="text-xs text-emerald-400">
                                            ✓ 已保存到工作区
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={onOpenAIGenerator}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition-colors"
                                    >
                                        <span>✨</span>
                                        AI 生成配置
                                    </button>
                                    <button
                                        onClick={() => {
                                            // TODO: 实现打开工作区
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
                                    >
                                        <span>🔗</span>
                                        打开工作区
                                    </button>
                                    <button
                                        onClick={onSave}
                                        disabled={state?.saving}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors disabled:opacity-40"
                                    >
                                        {state?.saving ? (
                                            <span className="animate-spin">⏳</span>
                                        ) : (
                                            <span>💾</span>
                                        )}
                                        保存文件
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// Agent File Editor Component
interface AgentFileEditorProps {
    filename: string
    workspacePath: string
    value: string
    placeholder: string
    onChange: (value: string) => void
}

function AgentFileEditor({
    filename,
    workspacePath,
    value,
    placeholder,
    onChange,
}: AgentFileEditorProps) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
                <span className="text-gray-600 truncate max-w-[260px]">{workspacePath}/</span>
                <span className="text-gray-400 font-semibold shrink-0">{filename}</span>
            </div>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                rows={12}
                className="w-full rounded-lg border border-gray-700 bg-gray-900/20 px-3 py-2.5 text-xs font-mono text-white placeholder:text-gray-600 resize-y focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition"
                spellCheck={false}
            />
        </div>
    )
}

// Import FormSection
import { FormSection } from '../common/FormSection'
