'use client'

import { useState, useEffect } from 'react'
import { skillApi, configApi, type OpenclawConfig } from '@/lib/tauri'

interface RecommendedSkill {
    name: string
    description?: string
    category?: string
    reason?: string
    score?: number
}

export default function AiSkillsTab() {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<RecommendedSkill[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [streamContent, setStreamContent] = useState('')
    const [config, setConfig] = useState<OpenclawConfig | null>(null)
    const [installingSlug, setInstallingSlug] = useState<string | null>(null)

    // 加载配置
    useEffect(() => {
        loadConfig()
    }, [])

    const loadConfig = async () => {
        try {
            const cfg = await configApi.read()
            setConfig(cfg)
        } catch (err) {
            console.error('Failed to load config:', err)
        }
    }

    const getApiConfig = () => {
        if (!config?.models?.providers) {
            return null
        }

        const providers = config.models.providers
        const getApiKey = (provider: any) => provider?.apiKey ?? provider?.api_key
        const getBaseUrl = (provider: any) => provider?.baseUrl ?? provider?.base_url ?? provider?.api
        const getModelId = (provider: any) => {
            const model = provider?.models?.[0]
            return typeof model === 'string' ? model : model?.id
        }

        const normalizeBaseUrl = (url: string) => {
            const u = (url || '').trim().replace(/\/+$/, '')
            if (!u) return u
            if (!/\/v\d+$/i.test(u) && !/\/v\d+\//i.test(u)) {
                return `${u}/v1`
            }
            return u
        }

        // 1. 优先使用 Agents 默认模型指定的提供商
        const defaultProviderId = config.agents?.defaults?.model?.primary?.split('/')[0]
        if (defaultProviderId) {
            const p = providers[defaultProviderId]
            if (getApiKey(p)) {
                return {
                    apiKey: getApiKey(p),
                    provider: defaultProviderId,
                    baseUrl: normalizeBaseUrl(getBaseUrl(p)),
                    model: getModelId(p),
                }
            }
        }

        // 2. 兼容旧逻辑：优先 deepseek / kimi
        const deepseek = providers['deepseek']
        if (getApiKey(deepseek)) {
            return {
                apiKey: getApiKey(deepseek),
                provider: 'deepseek',
                baseUrl: normalizeBaseUrl(getBaseUrl(deepseek) || 'https://api.deepseek.com'),
                model: getModelId(deepseek) || 'deepseek-chat',
            }
        }

        const kimi = providers['kimi']
        if (getApiKey(kimi)) {
            return {
                apiKey: getApiKey(kimi),
                provider: 'kimi',
                baseUrl: normalizeBaseUrl(getBaseUrl(kimi) || 'https://api.moonshot.cn/v1'),
                model: getModelId(kimi) || 'moonshot-v1-8k',
            }
        }

        // 3. 否则选第一个有 api_key 的 provider
        const fallbackEntry = Object.entries(providers).find(([, p]) => getApiKey(p))
        if (fallbackEntry) {
            const [id, p] = fallbackEntry
            return {
                apiKey: getApiKey(p)!,
                provider: id,
                baseUrl: normalizeBaseUrl(getBaseUrl(p)),
                model: getModelId(p),
            }
        }

        return null
    }

    const handleSearch = async () => {
        if (!query.trim()) return

        const apiConfig = getApiConfig()
        if (!apiConfig) {
            setError('请先在配置页面中配置大模型')
            return
        }

        setLoading(true)
        setError(null)
        setResults([])
        setStreamContent('')

        try {
            const skills = await skillApi.recommend(
                query,
                apiConfig.apiKey,
                apiConfig.provider,
                apiConfig.baseUrl,
                (apiConfig as any).model,
            )

            setResults(skills as RecommendedSkill[])
        } catch (err) {
            console.error('Recommend error:', err)
            const message =
                typeof err === 'string'
                    ? err
                    : err instanceof Error
                    ? err.message
                    : '推荐失败'
            setError(message)
        } finally {
            setLoading(false)
        }
    }

    const getWorkspacePath = () => {
        const ws = config?.agents?.defaults?.workspace?.trim()
        return ws && ws.length > 0 ? ws : '~/.openclaw/workspace'
    }

    const handleInstall = async (skill: RecommendedSkill) => {
        if (!config) {
            setError('请先在配置页面中配置工作区和 Agent')
            return
        }

        const workspacePath = getWorkspacePath()

        setInstallingSlug(skill.name)
        setError(null)

        try {
            await skillApi.install(workspacePath, skill.name)
        } catch (err) {
            console.error('Install skill error:', err)
            const message =
                typeof err === 'string'
                    ? err
                    : err instanceof Error
                    ? err.message
                    : '安装失败'
            setError(message)
        } finally {
            setInstallingSlug(null)
        }
    }

    const parseStreamResults = (content: string) => {
        try {
            // 尝试提取 JSON 数组
            const jsonMatch = content.match(/\[[\s\S]*\]/)
            if (!jsonMatch) {
                setError('AI 返回格式错误')
                return
            }

            const parsed = JSON.parse(jsonMatch[0]) as RecommendedSkill[]
            setResults(parsed)
        } catch (err) {
            console.error('Parse error:', err)
            setError('解析 AI 响应失败')
        }
    }

    const handleExampleClick = (example: string) => {
        setQuery(example)
    }

    return (
        <div className="flex-1 flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-6xl mx-auto">
                    {/* Page header */}
                    <div className="mb-6">
                        <h1 className="text-xl font-bold text-white mb-1">AI 推荐</h1>
                        <p className="text-sm text-gray-400 leading-relaxed">
                            用自然语言描述需求，AI 将为你智能推荐合适的技能。
                        </p>
                    </div>

                    {/* Search row */}
                    <div className="space-y-3 mb-8">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400">✨</span>
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                            handleSearch()
                                        }
                                    }}
                                    placeholder="描述你的需求，AI 将为你推荐合适的技能…"
                                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-blue-500/30 bg-gray-900 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                />
                            </div>
                            <button
                                onClick={handleSearch}
                                disabled={!query.trim() || loading}
                                className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm transition-colors disabled:opacity-50"
                            >
                                <span>🔍</span>
                                推荐
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <p className="text-[11px] text-gray-500">
                                使用 AI 大模型理解需求并推荐技能 ·{' '}
                                <span className="text-blue-400">DeepSeek V3 / Kimi</span>
                            </p>
                        </div>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-sm">
                            <p className="text-red-400 mb-2">{error}</p>
                            {error.includes('配置') && (
                                <button
                                    onClick={() => {
                                        // 通过自定义事件通知主应用切换到配置页面
                                        window.dispatchEvent(new CustomEvent('navigate-to-config'))
                                    }}
                                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                                >
                                    前往配置页面 →
                                </button>
                            )}
                        </div>
                    )}

                    {/* Loading state */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                            <p className="text-sm text-gray-400">AI 正在分析需求...</p>
                            {streamContent && (
                                <div className="mt-4 max-w-2xl p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                                    <p className="text-xs text-gray-300 whitespace-pre-wrap">{streamContent}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Results */}
                    {!loading && results.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-medium text-white">推荐结果</h2>
                                <span className="text-xs text-gray-400">{results.length} 个技能</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {results.map((skill, index) => (
                                    <div
                                        key={`${skill.name}-${index}`}
                                        className="p-4 rounded-lg border border-gray-700 bg-gray-800/50 hover:bg-gray-800 hover:border-gray-600 transition-all"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <h3 className="font-medium text-white text-sm">{skill.name}</h3>
                                            {skill.score && (
                                                <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                                                    {Math.round(skill.score * 100)}%
                                                </span>
                                            )}
                                        </div>
                                        {skill.description && (
                                            <p className="text-xs text-gray-400 mb-2">{skill.description}</p>
                                        )}
                                        {skill.reason && (
                                            <p className="text-xs text-gray-500 mb-3 italic">💡 {skill.reason}</p>
                                        )}
                                        {skill.category && (
                                            <span className="inline-block text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300 mb-3">
                                                {skill.category}
                                            </span>
                                        )}
                                        <button
                                            onClick={() => handleInstall(skill)}
                                            disabled={installingSlug === skill.name}
                                            className="w-full px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 disabled:bg-gray-700 text-blue-400 disabled:text-gray-400 text-xs transition-colors"
                                        >
                                            {installingSlug === skill.name ? '安装中...' : '安装'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && results.length === 0 && !error && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-20 h-20 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6">
                                <span className="text-4xl">✨</span>
                            </div>
                            <h2 className="text-lg font-semibold text-white mb-2">AI 智能推荐</h2>
                            <p className="text-sm text-gray-400 max-w-md leading-relaxed mb-6">
                                使用 AI 大模型理解你的需求，智能推荐最合适的技能。
                            </p>
                            <div className="flex flex-col gap-2 text-xs text-gray-500 mb-8">
                                <p>✓ 自然语言描述需求</p>
                                <p>✓ AI 智能分析匹配</p>
                                <p>✓ 显示推荐理由和匹配度</p>
                                <p>✓ 一键安装到工作区</p>
                            </div>

                            {/* Example queries */}
                            <div className="w-full max-w-2xl">
                                <p className="text-xs text-gray-500 mb-3">示例需求：</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {[
                                        '帮我搜索网页内容',
                                        '解析视频字幕',
                                        '管理 Google 文档',
                                        '发送邮件通知',
                                    ].map((example) => (
                                        <button
                                            key={example}
                                            onClick={() => handleExampleClick(example)}
                                            className="px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs text-left transition-colors"
                                        >
                                            {example}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
