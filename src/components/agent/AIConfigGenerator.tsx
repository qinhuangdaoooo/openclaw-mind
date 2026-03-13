'use client'

import { useState, useEffect } from 'react'
import {
    agentApi,
    configApi,
    getDefaultProviderId,
    getProviderApiKey,
    getProviderBaseUrl,
    getProviderModelId,
    type OpenclawConfig,
    type StreamChunk,
} from '@/lib/tauri'

interface AIConfigGeneratorProps {
    workspace: string
    onClose: () => void
    onSuccess: () => void
}

export default function AIConfigGenerator({ workspace, onClose, onSuccess }: AIConfigGeneratorProps) {
    const [description, setDescription] = useState('')
    const [generating, setGenerating] = useState(false)
    const [streamContent, setStreamContent] = useState('')
    const [generatedConfig, setGeneratedConfig] = useState<{
        soul: string
        agents: string
        memory: string
    } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [config, setConfig] = useState<OpenclawConfig | null>(null)
    const [rawAiOutput, setRawAiOutput] = useState<string>('')

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

    const normalizeBaseUrl = (url: string) => {
        const u = (url || '').trim().replace(/\/+$/, '')
        if (!u) return u
        // 常见 OpenAI 兼容网关需要 /v1
        if (!/\/v\d+$/i.test(u) && !/\/v\d+\//i.test(u)) {
            return `${u}/v1`
        }
        return u
    }

    const getApiConfig = () => {
        if (!config?.models?.providers) {
            return null
        }

        const providers = config.models.providers

        // 1. 优先使用 Agents 默认模型指定的提供商
        const defaultProviderId = getDefaultProviderId(config)
        if (defaultProviderId) {
            const p = providers[defaultProviderId]
            const apiKey = getProviderApiKey(p)
            if (apiKey) {
                return {
                    apiKey,
                    provider: defaultProviderId,
                    baseUrl: normalizeBaseUrl(getProviderBaseUrl(p) || ''),
                    model: p.models?.map((model) => getProviderModelId(model)).find(Boolean),
                }
            }
        }

        // 2. 兼容旧逻辑：优先 deepseek / kimi
        const deepseek = providers['deepseek']
        if (getProviderApiKey(deepseek)) {
            return {
                apiKey: getProviderApiKey(deepseek)!,
                provider: 'deepseek',
                baseUrl: normalizeBaseUrl(getProviderBaseUrl(deepseek) || 'https://api.deepseek.com'),
                model: deepseek.models?.map((model) => getProviderModelId(model)).find(Boolean) || 'deepseek-chat',
            }
        }

        const kimi = providers['kimi']
        if (getProviderApiKey(kimi)) {
            return {
                apiKey: getProviderApiKey(kimi)!,
                provider: 'kimi',
                baseUrl: normalizeBaseUrl(getProviderBaseUrl(kimi) || 'https://api.moonshot.cn/v1'),
                model: kimi.models?.map((model) => getProviderModelId(model)).find(Boolean) || 'moonshot-v1-8k',
            }
        }

        // 3. 否则选第一个有 api_key 的 provider
        const fallbackEntry = Object.entries(providers).find(([, p]) => getProviderApiKey(p))
        if (fallbackEntry) {
            const [id, p] = fallbackEntry
            return {
                apiKey: getProviderApiKey(p)!,
                provider: id,
                baseUrl: normalizeBaseUrl(getProviderBaseUrl(p) || ''),
                model: p.models?.map((model) => getProviderModelId(model)).find(Boolean),
            }
        }

        return null
    }

    const handleGenerate = async () => {
        if (!description.trim()) return

        const apiConfig = getApiConfig()
        if (!apiConfig) {
            setError('请先在配置页面中配置大模型')
            return
        }

        setGenerating(true)
        setError(null)
        setStreamContent('')
        setGeneratedConfig(null)

        try {
            const unlisten = await agentApi.generateConfigAI(
                description,
                apiConfig.apiKey,
                apiConfig.provider,
                apiConfig.baseUrl,
                apiConfig.model,
                (chunk: StreamChunk) => {
                    if (!chunk.done) {
                        setStreamContent(prev => prev + chunk.content)
                    }
                },
                (content: string) => {
                    setGenerating(false)
                    setRawAiOutput(content)
                    parseGeneratedConfig(content)
                },
                (message: string) => {
                    setGenerating(false)
                    setError(message || '生成失败')
                }
            )

            return () => {
                unlisten()
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '生成失败')
            setGenerating(false)
        }
    }

    const extractJsonObject = (text: string): string | null => {
        const trimmed = text.trim()
        if (!trimmed) return null

        // 1) 直接就是 JSON
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed

        // 2) 代码块 ```json ... ``` 或 ``` ... ```
        const fenceMatch =
            trimmed.match(/```json\s*([\s\S]*?)\s*```/i) ||
            trimmed.match(/```\s*([\s\S]*?)\s*```/i)
        if (fenceMatch?.[1]) {
            const inside = fenceMatch[1].trim()
            if (inside.startsWith('{') && inside.endsWith('}')) return inside
        }

        // 3) 括号配对提取第一个完整 JSON object（忽略字符串内的大括号）
        const start = trimmed.indexOf('{')
        if (start < 0) return null

        let depth = 0
        let inString = false
        let escaped = false

        for (let i = start; i < trimmed.length; i++) {
            const ch = trimmed[i]

            if (inString) {
                if (escaped) {
                    escaped = false
                } else if (ch === '\\') {
                    escaped = true
                } else if (ch === '"') {
                    inString = false
                }
                continue
            }

            if (ch === '"') {
                inString = true
                continue
            }

            if (ch === '{') depth++
            if (ch === '}') {
                depth--
                if (depth === 0) {
                    return trimmed.slice(start, i + 1)
                }
            }
        }

        return null
    }

    const parseGeneratedConfig = (content: string) => {
        try {
            const jsonText = extractJsonObject(content)
            if (!jsonText) {
                const preview = content.trim().slice(0, 400)
                setError(`AI 返回格式错误，无法解析配置。\n\n原始返回（前 400 字）：\n${preview || '(空)'}\n`)
                return
            }

            const parsed = JSON.parse(jsonText)
            setGeneratedConfig({
                soul: parsed.soul || '',
                agents: parsed.agents || '',
                memory: parsed.memory || '',
            })
        } catch (err) {
            console.error('Parse error:', err)
            const preview = content.trim().slice(0, 400)
            setError(`解析 AI 响应失败。\n\n原始返回（前 400 字）：\n${preview || '(空)'}\n`)
        }
    }

    const handleApply = async () => {
        if (!generatedConfig) return

        try {
            await agentApi.writeWorkspaceFile(workspace, 'SOUL.md', generatedConfig.soul)
            await agentApi.writeWorkspaceFile(workspace, 'AGENTS.md', generatedConfig.agents)
            await agentApi.writeWorkspaceFile(workspace, 'MEMORY.md', generatedConfig.memory)

            onSuccess()
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : '应用配置失败')
        }
    }

    const exampleDescriptions = [
        '产品经理 Agent，负责需求分析、产品规划和用户研究',
        '技术支持 Agent，专注于解决用户技术问题和提供帮助',
        '数据分析 Agent，擅长数据处理、可视化和洞察分析',
        '内容创作 Agent，专业的文案撰写和内容策划',
    ]

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b border-gray-700">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <span>✨</span>
                        AI 生成 Agent 配置
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                        描述你的 Agent 角色和职责，AI 将自动生成专业的配置文件
                    </p>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {!generating && !generatedConfig && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Agent 描述
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="例如：这是一个产品经理 Agent，负责需求分析、产品规划、用户研究。需要具备同理心、逻辑思维和沟通能力..."
                                    className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 min-h-32 resize-y"
                                />
                                <p className="text-xs text-gray-500 mt-1.5">
                                    详细描述 Agent 的角色、职责、专业领域和期望的性格特点
                                </p>
                            </div>

                            <div>
                                <p className="text-xs text-gray-400 mb-2">示例描述：</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {exampleDescriptions.map((example, index) => (
                                        <button
                                            key={index}
                                            onClick={() => setDescription(example)}
                                            className="px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs text-left transition-colors"
                                        >
                                            {example}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-sm text-blue-300">
                                <p className="font-medium mb-1">📝 将生成以下文件：</p>
                                <ul className="text-xs space-y-1 text-blue-300/80">
                                    <li>• SOUL.md - Agent 的核心身份、性格和价值观</li>
                                    <li>• AGENTS.md - 协作规则和其他 Agent 信息</li>
                                    <li>• MEMORY.md - 记忆模板和重要信息结构</li>
                                </ul>
                            </div>
                        </>
                    )}

                    {generating && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-gray-300">AI 生成中</label>
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                    <div className="w-3 h-3 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin"></div>
                                    生成中...
                                </div>
                            </div>
                            <div className="bg-gray-950 rounded-lg p-3 font-mono text-xs text-gray-300 max-h-96 overflow-y-auto whitespace-pre-wrap">
                                {streamContent || '等待 AI 响应...'}
                            </div>
                        </div>
                    )}

                    {generatedConfig && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-green-400">✓ 配置生成完成</p>
                                <button
                                    onClick={() => {
                                        setGeneratedConfig(null)
                                        setStreamContent('')
                                    }}
                                    className="text-xs text-gray-400 hover:text-gray-300"
                                >
                                    重新生成
                                </button>
                            </div>

                            {['soul', 'agents', 'memory'].map((key) => (
                                <div key={key}>
                                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                                        {key === 'soul' ? 'SOUL.md' : key === 'agents' ? 'AGENTS.md' : 'MEMORY.md'}
                                    </label>
                                    <textarea
                                        value={generatedConfig[key as keyof typeof generatedConfig]}
                                        onChange={(e) => setGeneratedConfig({
                                            ...generatedConfig,
                                            [key]: e.target.value
                                        })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 min-h-32 resize-y"
                                    />
                                </div>
                            ))}

                            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-xs text-green-300">
                                <p>你可以在上方编辑生成的内容，然后点击"应用配置"保存到工作区</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm">
                            <p className="text-red-400 mb-2">{error}</p>
                            {!generatedConfig && rawAiOutput.trim() && (
                                <details className="mt-2">
                                    <summary className="text-xs text-gray-300 cursor-pointer select-none">
                                        查看完整原始返回
                                    </summary>
                                    <pre className="mt-2 text-[11px] text-gray-300 bg-gray-950/60 border border-gray-700 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-words">
                                        {rawAiOutput}
                                    </pre>
                                </details>
                            )}
                            {error.includes('配置') && (
                                <button
                                    onClick={() => {
                                        // 通过自定义事件通知主应用切换到配置页面
                                        window.dispatchEvent(new CustomEvent('navigate-to-config'))
                                        onClose()
                                    }}
                                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                                >
                                    前往配置页面 →
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-700 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        disabled={generating}
                        className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                        取消
                    </button>
                    {!generatedConfig ? (
                        <button
                            onClick={handleGenerate}
                            disabled={!description.trim() || generating}
                            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
                        >
                            <span>✨</span>
                            生成配置
                        </button>
                    ) : (
                        <button
                            onClick={handleApply}
                            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm flex items-center gap-2"
                        >
                            <span>✓</span>
                            应用配置
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
