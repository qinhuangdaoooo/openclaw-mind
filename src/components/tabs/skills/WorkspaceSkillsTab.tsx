'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
    skillApi,
    Skill,
    StreamChunk,
    configApi,
    agentApi,
    Agent,
    getProviderApiKey,
    getProviderBaseUrl,
    systemApi,
} from '@/lib/tauri'

// Types
interface AgentSource {
    agentId: string
    label: string
    skillsPath: string
    isMain: boolean
}

type SourceId = string // 'agent:<id>' | 'ssh:<connId>'

export default function WorkspaceSkillsTab() {
    const [mounted, setMounted] = useState(false)
    const [config, setConfig] = useState<any>(null)
    const [agents, setAgents] = useState<Agent[]>([])

    // Source selection
    const [sourceId, setSourceId] = useState<SourceId>('agent:main')

    // Skills data
    const [skills, setSkills] = useState<Skill[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [skillsDir, setSkillsDir] = useState('')

    // UI state
    const [searchQuery, setSearchQuery] = useState('')
    const [aiQuery, setAiQuery] = useState('')
    const [aiResponse, setAiResponse] = useState('')
    const [isStreaming, setIsStreaming] = useState(false)
    const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
    const [categoryFilter, setCategoryFilter] = useState<string>('all')

    // Load config and agents on mount
    useEffect(() => {
        setMounted(true)
        loadInitialData()
    }, [])

    const loadInitialData = async () => {
        try {
            const [configData, agentsList] = await Promise.all([
                configApi.read(),
                agentApi.list()
            ])
            setConfig(configData)
            setAgents(agentsList)
        } catch (err) {
            console.error('Failed to load initial data:', err)
        }
    }

    // Derive agent sources from config
    const agentSources: AgentSource[] = useMemo(() => {
        const defaultWs = config?.agents?.defaults?.workspace?.trim() || '~/.openclaw/workspace'
        const list = agents || []

        // Ensure main is first
        const sortedAgents: Agent[] = list.some(a => a.id === 'main')
            ? list
            : [{ id: 'main', workspace: defaultWs } as Agent, ...list]

        return sortedAgents.map(agent => ({
            agentId: agent.id,
            label: agent.id === 'main' ? '主 Agent' : (agent.name?.trim() || agent.id),
            skillsPath: `${agent.workspace?.trim() || defaultWs}/skills`,
            isMain: agent.id === 'main'
        }))
    }, [config, agents])

    const currentAgent = useMemo(() => {
        return agentSources.find(a => `agent:${a.agentId}` === sourceId) || agentSources[0] || null
    }, [agentSources, sourceId])

    // Load skills when source changes
    useEffect(() => {
        if (!mounted) return
        setSearchQuery('')
        loadSkills()
    }, [sourceId, mounted])

    const loadSkills = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            let list: Skill[] = []

            if (currentAgent) {
                // 对主 Agent 使用默认工作区，对其他 Agent 使用各自的 workspace
                const defaultWs = config?.agents?.defaults?.workspace?.trim() || '~/.openclaw/workspace'
                const workspacePath = currentAgent.isMain
                    ? defaultWs
                    : currentAgent.skillsPath.replace(/\/skills\/?$/, '')

                list = await skillApi.listAgentSkills(workspacePath)

                // 记录 skills 目录用于 UI 展示和“打开目录”
                setSkillsDir(`${workspacePath}/skills`)
            } else {
                list = []
                setSkillsDir('')
            }

            setSkills(list)
        } catch (err) {
            setError(String(err))
        } finally {
            setLoading(false)
        }
    }, [currentAgent, config])

    const handleRefresh = () => {
        loadSkills()
    }

    const handleOpenDirectory = async () => {
        if (!skillsDir) return
        try {
            await systemApi.openPathInFinder(skillsDir)
        } catch (err) {
            console.error('Failed to open directory:', err)
            alert(`无法打开目录: ${String(err)}`)
        }
    }

    const handleSearch = async () => {
        if (!searchQuery.trim()) return

        setLoading(true)
        setError(null)
        try {
            const results = await skillApi.searchClawHub(searchQuery, 20)
            setSkills(results)
        } catch (err) {
            setError(String(err))
        } finally {
            setLoading(false)
        }
    }

    const handleAiRecommend = async () => {
        if (!aiQuery.trim()) return

        setIsStreaming(true)
        setAiResponse('')
        setError(null)

        try {
            // 读取配置获取 API 信息
            const config = await configApi.read()
            const provider = Object.keys(config.models?.providers || {})[0] || 'openai'
            const providerConfig = config.models?.providers[provider]

            const apiKey = getProviderApiKey(providerConfig)
            if (!apiKey) {
                setError('请先在配置页面设置 API Key')
                setIsStreaming(false)
                return
            }

            const baseUrl = getProviderBaseUrl(providerConfig) || ''

            // 启动流式推荐
            await skillApi.recommendStream(
                aiQuery,
                apiKey,
                provider,
                baseUrl,
                (chunk: StreamChunk) => {
                    if (chunk.done) {
                        setIsStreaming(false)
                        // 尝试解析 JSON 结果
                        try {
                            const skillNames = JSON.parse(aiResponse)
                            if (Array.isArray(skillNames)) {
                                const recommendedSkills: Skill[] = skillNames.map((name: string) => ({
                                    name,
                                    source: 'recommended' as const,
                                    description: 'AI 推荐的技能',
                                }))
                                setSkills(recommendedSkills)
                            }
                        } catch (e) {
                            // 如果不是 JSON，显示原始响应
                            console.error('解析 AI 响应失败:', e)
                        }
                    } else {
                        setAiResponse((prev) => prev + chunk.content)
                    }
                }
            )
        } catch (err) {
            setError(String(err))
            setIsStreaming(false)
        }
    }

    const getSourceBadge = (source: string) => {
        switch (source) {
            case 'local':
                return <span className="px-2 py-1 bg-green-900/50 text-green-400 text-xs rounded">本地</span>
            case 'clawhub':
                return <span className="px-2 py-1 bg-blue-900/50 text-blue-400 text-xs rounded">ClawHub</span>
            case 'recommended':
                return <span className="px-2 py-1 bg-purple-900/50 text-purple-400 text-xs rounded">推荐</span>
            default:
                return null
        }
    }

    const categories = ['all', ...Array.from(new Set(skills.map(s => s.category).filter((c): c is string => Boolean(c))))]
    const filteredSkills = categoryFilter === 'all'
        ? skills
        : skills.filter(s => s.category === categoryFilter)

    // 判断是否为主 Agent
    const isMainAgent = currentAgent?.isMain ?? false

    return (
        <div className="flex-1 flex flex-col h-full">
            {/* Source Selector */}
            <div className="flex items-center gap-1.5 px-6 py-4 border-b border-gray-700 bg-gray-800/30 flex-wrap">
                <span className="text-xs text-gray-400 shrink-0 mr-0.5">技能来源：</span>

                {/* Local agents */}
                {agentSources.map((agent) => {
                    const id = `agent:${agent.agentId}`
                    const active = sourceId === id

                    return (
                        <button
                            key={id}
                            onClick={() => setSourceId(id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${active
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-gray-400 hover:text-white hover:bg-gray-700'
                                }`}
                        >
                            {agent.agentId === 'main' ? (
                                <span>🖥️</span>
                            ) : (
                                <span>🤖</span>
                            )}
                            {agent.label}
                        </button>
                    )
                })}

                {agentSources.length === 0 && (
                    <span className="text-xs text-gray-500 italic ml-1">
                        （前往「Agent 管理」创建 Agent）
                    </span>
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="mb-6 flex items-start justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-white mb-1">
                                {currentAgent?.isMain
                                    ? '工作区技能'
                                    : `${currentAgent?.label} · 工作区技能`}
                            </h1>
                            <p className="text-sm text-gray-400">
                                {currentAgent?.isMain
                                    ? '主 Agent 工作区中已安装的技能列表'
                                    : `Agent "${currentAgent?.agentId}" 专属工作区中已安装的技能列表`}
                            </p>
                            {/* Show workspace path for non-main agents */}
                            {currentAgent && !currentAgent.isMain && (
                                <p className="text-xs text-gray-500 font-mono mt-1">
                                    工作区：{currentAgent.skillsPath.replace('/skills', '')}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Local Install Button - only for main agent */}
                            {sourceId === 'agent:main' && (
                                <button
                                    onClick={() => alert('本地安装功能待实现')}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
                                >
                                    <span>📦</span>
                                    本地安装
                                </button>
                            )}
                            <button
                                onClick={handleRefresh}
                                disabled={loading}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors disabled:opacity-40"
                            >
                                <span className={loading ? 'animate-spin' : ''}>🔄</span>
                                刷新
                            </button>
                        </div>
                    </div>

                    {/* Search Bar + Open Directory */}
                    <div className="flex items-center gap-2 mb-2">
                        <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="搜索技能名称或描述..."
                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-700 bg-gray-900 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                            />
                        </div>
                        {skillsDir && (
                            <button
                                onClick={handleOpenDirectory}
                                title={skillsDir}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-700 text-xs text-gray-400 hover:bg-gray-700 hover:text-white transition-all shrink-0"
                            >
                                <span>📁</span>
                                打开目录
                            </button>
                        )}
                    </div>
                    {skillsDir && (
                        <p className="text-xs font-mono text-gray-500 mb-4 truncate">{skillsDir}</p>
                    )}

                    {/* Search Bar */}
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="搜索技能..."
                                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            />
                            <button
                                onClick={handleSearch}
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
                            >
                                🔍 搜索
                            </button>
                            <button
                                onClick={loadSkills}
                                disabled={loading}
                                className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white px-6 py-2 rounded-lg transition-colors"
                            >
                                📁 本地
                            </button>
                        </div>

                        {/* Category Filter */}
                        {categories.length > 1 && (
                            <div className="flex gap-2 flex-wrap">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setCategoryFilter(cat)}
                                        className={`px-3 py-1 rounded-lg text-sm transition-colors ${categoryFilter === cat
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            }`}
                                    >
                                        {cat === 'all' ? '全部' : cat}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* AI Recommend */}
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                value={aiQuery}
                                onChange={(e) => setAiQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAiRecommend()}
                                placeholder="描述你需要的技能，AI 将为你推荐..."
                                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                            />
                            <button
                                onClick={handleAiRecommend}
                                disabled={isStreaming}
                                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
                            >
                                {isStreaming ? '⏳ 推荐中...' : '✨ AI 推荐'}
                            </button>
                        </div>

                        {/* AI Response Stream */}
                        {(isStreaming || aiResponse) && (
                            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-sm text-gray-300">
                                <div className="flex items-center gap-2 mb-2 text-purple-400">
                                    <span>🤖</span>
                                    <span className="font-semibold">AI 响应</span>
                                    {isStreaming && (
                                        <span className="animate-pulse">▋</span>
                                    )}
                                </div>
                                <pre className="whitespace-pre-wrap font-mono text-xs">
                                    {aiResponse || '等待响应...'}
                                </pre>
                            </div>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4">
                            {error}
                        </div>
                    )}

                    {/* Skills List */}
                    {loading && skills.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p>加载中...</p>
                        </div>
                    ) : filteredSkills.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <p className="text-4xl mb-4">⚡</p>
                            <p>暂无技能</p>
                            <p className="text-sm mt-2">尝试搜索或使用 AI 推荐</p>
                        </div>
                    ) : (
                        <div className={isMainAgent ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-2"}>
                            {filteredSkills.map((skill, idx) => (
                                isMainAgent ? (
                                    // 主 Agent - 完整卡片
                                    <div
                                        key={idx}
                                        onClick={() => setSelectedSkill(skill)}
                                        className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-white mb-1">{skill.name}</h3>
                                                {getSourceBadge(skill.source)}
                                            </div>
                                        </div>
                                        {skill.description && (
                                            <p className="text-sm text-gray-400 mb-3 line-clamp-2">{skill.description}</p>
                                        )}
                                        <div className="flex items-center justify-between text-xs text-gray-500">
                                            {skill.category && <span>📂 {skill.category}</span>}
                                            {skill.version && <span>v{skill.version}</span>}
                                        </div>
                                        {skill.author && (
                                            <div className="text-xs text-gray-500 mt-2">
                                                👤 {skill.author}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    // 其他 Agent - 简化卡片
                                    <div
                                        key={idx}
                                        className="flex items-start gap-3 px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 hover:bg-gray-700/30 transition-colors"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                            <span className="text-lg">📦</span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-white font-mono">{skill.name}</p>
                                            {skill.description && (
                                                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed line-clamp-2">
                                                    {skill.description}
                                                </p>
                                            )}
                                        </div>
                                        {currentAgent && (
                                            <span className="shrink-0 text-xs text-gray-500 mt-0.5 font-mono">
                                                {currentAgent.agentId}
                                            </span>
                                        )}
                                    </div>
                                )
                            ))}
                        </div>
                    )}

                    {/* Skill Detail Modal */}
                    {selectedSkill && (
                        <div
                            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                            onClick={() => setSelectedSkill(null)}
                        >
                            <div
                                className="bg-gray-800 border border-gray-700 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Modal Header */}
                                <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-start justify-between">
                                    <div className="flex-1">
                                        <h2 className="text-2xl font-bold text-white mb-2">{selectedSkill.name}</h2>
                                        <div className="flex items-center gap-2">
                                            {getSourceBadge(selectedSkill.source)}
                                            {selectedSkill.version && (
                                                <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
                                                    v{selectedSkill.version}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedSkill(null)}
                                        className="text-gray-400 hover:text-white transition-colors text-2xl"
                                    >
                                        ×
                                    </button>
                                </div>

                                {/* Modal Body */}
                                <div className="p-6 space-y-6">
                                    {/* Description */}
                                    {selectedSkill.description && (
                                        <div>
                                            <h3 className="text-white font-semibold mb-2">📝 描述</h3>
                                            <p className="text-gray-300 text-sm">{selectedSkill.description}</p>
                                        </div>
                                    )}

                                    {/* Info Grid */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {selectedSkill.category && (
                                            <div className="bg-gray-900 rounded-lg p-3">
                                                <div className="text-gray-400 text-xs mb-1">分类</div>
                                                <div className="text-white text-sm">📂 {selectedSkill.category}</div>
                                            </div>
                                        )}
                                        {selectedSkill.author && (
                                            <div className="bg-gray-900 rounded-lg p-3">
                                                <div className="text-gray-400 text-xs mb-1">作者</div>
                                                <div className="text-white text-sm">👤 {selectedSkill.author}</div>
                                            </div>
                                        )}
                                        {selectedSkill.version && (
                                            <div className="bg-gray-900 rounded-lg p-3">
                                                <div className="text-gray-400 text-xs mb-1">版本</div>
                                                <div className="text-white text-sm">🏷️ {selectedSkill.version}</div>
                                            </div>
                                        )}
                                        <div className="bg-gray-900 rounded-lg p-3">
                                            <div className="text-gray-400 text-xs mb-1">来源</div>
                                            <div className="text-white text-sm">
                                                {selectedSkill.source === 'local' && '💾 本地'}
                                                {selectedSkill.source === 'clawhub' && '🌐 ClawHub'}
                                                {selectedSkill.source === 'recommended' && '✨ AI 推荐'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Documentation */}
                                    <div>
                                        <h3 className="text-white font-semibold mb-2">📚 文档</h3>
                                        <div className="bg-gray-900 rounded-lg p-4 text-sm text-gray-400">
                                            <p>技能文档功能即将推出...</p>
                                            <p className="mt-2">将支持查看技能的详细使用说明、API 文档和示例代码。</p>
                                        </div>
                                    </div>

                                    {/* Dependencies */}
                                    <div>
                                        <h3 className="text-white font-semibold mb-2">🔗 依赖</h3>
                                        <div className="bg-gray-900 rounded-lg p-4 text-sm text-gray-400">
                                            <p>暂无依赖信息</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Modal Footer */}
                                <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 p-6 flex gap-3">
                                    {selectedSkill.source === 'local' ? (
                                        <button className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors">
                                            🗑️ 卸载
                                        </button>
                                    ) : (
                                        <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                                            📥 安装
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setSelectedSkill(null)}
                                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                                    >
                                        关闭
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
