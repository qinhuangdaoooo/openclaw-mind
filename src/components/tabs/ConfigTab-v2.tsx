'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { configApi, OpenclawConfig } from '@/lib/tauri'
import { FormSection } from '@/components/config/FormSection'
import { GatewayFields } from '@/components/config/GatewayFields'
import { ProviderCard } from '@/components/config/ProviderCard'
import { FieldGroup } from '@/components/config/FieldGroup'
import { EnvVarsSection } from '@/components/config/EnvVarsSection'
import { ValidationBanner, ValidationIssue } from '@/components/config/ValidationBanner'
import { CanvasSection } from '@/components/config/CanvasSection'
import { WhatsAppSection } from '@/components/config/WhatsAppSection'
import { TagInput } from '@/components/config/TagInput'

// Validation helper
function getConfigIssues(config: OpenclawConfig): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    const providers = config.models?.providers ?? {}

    if (Object.keys(providers).length === 0) {
        issues.push({ type: 'warning', key: 'no-providers', message: '未配置任何模型提供商' })
    }

    for (const [name, provider] of Object.entries(providers)) {
        if (!provider.models || provider.models.length === 0) {
            issues.push({
                type: 'error',
                key: `${name}:no-models`,
                message: `提供商「${name}」缺少模型列表（必须配置模型，否则网关无法启动）`,
            })
        }

        if (!provider.api_key?.trim()) {
            issues.push({
                type: 'warning',
                key: `${name}:no-apikey`,
                message: `提供商「${name}」未填写 API Key`,
            })
        }

        if (!provider.base_url?.trim() && !provider.api?.trim()) {
            issues.push({
                type: 'warning',
                key: `${name}:no-baseurl`,
                message: `提供商「${name}」未填写 Base URL`,
            })
        }
    }

    return issues
}

export default function ConfigTabV2() {
    const [config, setConfig] = useState<OpenclawConfig | null>(null)
    const [savedConfig, setSavedConfig] = useState<OpenclawConfig | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

    // UI state
    const [showPreview, setShowPreview] = useState(true)
    const [panelWidth, setPanelWidth] = useState(400)
    const [jsonText, setJsonText] = useState('')
    const [jsonError, setJsonError] = useState<string | null>(null)
    const [showAddProvider, setShowAddProvider] = useState(false)
    const [newProviderName, setNewProviderName] = useState('')

    // Refs
    const isDragging = useRef(false)
    const dragStartX = useRef(0)
    const dragStartWidth = useRef(0)
    const editorFocused = useRef(false)

    useEffect(() => {
        loadConfig()
    }, [])

    const loadConfig = async () => {
        setLoading(true)
        setError(null)
        try {
            console.log('Loading config...')
            const cfg = await configApi.read()
            console.log('Config loaded:', cfg)
            setConfig(cfg)
            setSavedConfig(cfg)
            setJsonText(JSON.stringify(cfg, null, 2))
        } catch (err) {
            console.error('Failed to load config:', err)
            setError(String(err))
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!config) return

        setSaveStatus('saving')
        setError(null)
        setSuccess(null)

        try {
            await configApi.write(config)
            setSavedConfig(config)
            setSaveStatus('saved')
            setSuccess('配置保存成功！')
            setTimeout(() => {
                setSuccess(null)
                setSaveStatus('idle')
            }, 3000)
        } catch (err) {
            setError(String(err))
            setSaveStatus('idle')
        }
    }

    const handleReloadGateway = async () => {
        setLoading(true)
        setError(null)
        setSuccess(null)
        try {
            const result = await configApi.reloadGateway()
            setSuccess(`Gateway 重载成功: ${result}`)
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            setError(String(err))
        } finally {
            setLoading(false)
        }
    }

    // Config update helpers
    const updateGateway = (gateway: NonNullable<OpenclawConfig['gateway']>) => {
        if (!config) return
        setConfig({ ...config, gateway })
    }

    const updateProvider = (name: string, updates: Partial<NonNullable<OpenclawConfig['models']>['providers'][string]>) => {
        if (!config) return
        const providers = config.models?.providers || {}
        setConfig({
            ...config,
            models: {
                ...config.models,
                mode: config.models?.mode || 'merge',
                providers: {
                    ...providers,
                    [name]: { ...providers[name], ...updates }
                }
            }
        })
    }

    const removeProvider = (name: string) => {
        if (!config) return
        const providers = { ...config.models?.providers }
        delete providers[name]
        setConfig({
            ...config,
            models: {
                ...config.models,
                mode: config.models?.mode || 'merge',
                providers
            }
        })
    }

    const addProvider = () => {
        if (!config || !newProviderName.trim()) return
        const providers = config.models?.providers || {}
        console.log('Before add:', config.models)
        const newConfig = {
            ...config,
            models: {
                mode: config.models?.mode || 'merge',
                providers: {
                    ...providers,
                    [newProviderName]: {
                        api: '',
                        base_url: '',
                        api_key: ''
                    }
                }
            }
        }
        console.log('After add:', newConfig.models)
        setConfig(newConfig)
        setNewProviderName('')
        setShowAddProvider(false)
    }

    const updateAgentDefaultModel = (model: string) => {
        if (!config) return
        setConfig({
            ...config,
            agents: {
                ...config.agents,
                defaults: {
                    ...config.agents?.defaults,
                    model: {
                        primary: model
                    }
                }
            }
        })
    }

    const updateAgentWorkspace = (workspace: string) => {
        if (!config) return
        setConfig({
            ...config,
            agents: {
                ...config.agents,
                defaults: {
                    ...config.agents?.defaults,
                    workspace
                }
            }
        })
    }

    const updateEnv = (env: Record<string, string>) => {
        if (!config) return
        setConfig({
            ...config,
            env
        })
    }

    const setCanvasEnabled = (enabled: boolean) => {
        if (!config) return
        setConfig({
            ...config,
            canvasHost: {
                ...config.canvasHost,
                enabled,
                port: config.canvasHost?.port ?? 18793
            }
        })
    }

    const setCanvasPort = (port: number) => {
        if (!config) return
        setConfig({
            ...config,
            canvasHost: {
                ...config.canvasHost,
                enabled: config.canvasHost?.enabled ?? true,
                port
            }
        })
    }

    const setWaGroupPolicy = (policy: 'open' | 'allowlist') => {
        if (!config) return
        setConfig({
            ...config,
            channels: {
                ...config.channels,
                whatsapp: {
                    ...config.channels?.whatsapp,
                    groupPolicy: policy,
                    allowFrom: config.channels?.whatsapp?.allowFrom ?? [],
                    groups: config.channels?.whatsapp?.groups ?? { '*': { requireMention: true } }
                }
            }
        })
    }

    const setWaAllowFrom = (numbers: string[]) => {
        if (!config) return
        setConfig({
            ...config,
            channels: {
                ...config.channels,
                whatsapp: {
                    ...config.channels?.whatsapp,
                    groupPolicy: config.channels?.whatsapp?.groupPolicy ?? 'open',
                    allowFrom: numbers,
                    groups: config.channels?.whatsapp?.groups ?? { '*': { requireMention: true } }
                }
            }
        })
    }

    const setWaRequireMention = (required: boolean) => {
        if (!config) return
        setConfig({
            ...config,
            channels: {
                ...config.channels,
                whatsapp: {
                    ...config.channels?.whatsapp,
                    groupPolicy: config.channels?.whatsapp?.groupPolicy ?? 'open',
                    allowFrom: config.channels?.whatsapp?.allowFrom ?? [],
                    groups: {
                        ...config.channels?.whatsapp?.groups,
                        '*': { requireMention: required }
                    }
                }
            }
        })
    }

    const setMentionPatterns = (patterns: string[]) => {
        if (!config) return
        setConfig({
            ...config,
            messages: {
                ...config.messages,
                groupChat: {
                    ...config.messages?.groupChat,
                    mentionPatterns: patterns
                }
            }
        })
    }

    // Sync config to JSON editor
    useEffect(() => {
        if (config && !editorFocused.current) {
            setJsonText(JSON.stringify(config, null, 2))
        }
    }, [config])

    // Drag to resize
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!isDragging.current) return
            const delta = dragStartX.current - e.clientX
            setPanelWidth(Math.max(300, Math.min(800, dragStartWidth.current + delta)))
        }

        const onUp = () => {
            isDragging.current = false
        }

        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)

        return () => {
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
        }
    }, [])

    const handleDragStart = (e: React.MouseEvent) => {
        isDragging.current = true
        dragStartX.current = e.clientX
        dragStartWidth.current = panelWidth
    }

    const handleJsonChange = (value: string) => {
        setJsonText(value)
        setJsonError(null)

        try {
            const parsed = JSON.parse(value)
            setConfig(parsed)
        } catch (err) {
            setJsonError(String(err))
        }
    }

    const isDirty = useMemo(() => {
        if (!config || !savedConfig) return false
        return JSON.stringify(config) !== JSON.stringify(savedConfig)
    }, [config, savedConfig])

    const validationIssues = useMemo(() => {
        return config ? getConfigIssues(config) : []
    }, [config])

    const hasErrors = validationIssues.some((i) => i.type === 'error')
    const canSave = !loading && isDirty && saveStatus !== 'saving' && !!config && !hasErrors

    const providerEntries = Object.entries(config?.models?.providers || {})
    const defaultProviderId = config?.agents?.defaults?.model?.primary

    if (loading && !config) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-400">加载配置中...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col h-full">
            {/* Header */}
            <div className="shrink-0 px-5 py-3 border-b border-gray-700 flex items-center justify-between bg-gray-800/60">
                <div>
                    <h1 className="text-lg font-bold text-white">配置文件</h1>
                    <p className="text-xs text-gray-400">OpenClaw 配置文件编辑</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                    >
                        {showPreview ? '隐藏 JSON' : '显示 JSON'}
                    </button>
                    <button
                        onClick={handleReloadGateway}
                        disabled={loading}
                        className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white rounded transition-colors"
                    >
                        🔄 重载 Gateway
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!canSave}
                        className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded transition-colors flex items-center gap-1"
                    >
                        {saveStatus === 'saving' ? (
                            <>
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                保存中...
                            </>
                        ) : (
                            <>💾 保存</>
                        )}
                    </button>
                </div>
            </div>

            {/* Messages */}
            {error && (
                <div className="shrink-0 mx-5 mt-3 bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}
            {success && (
                <div className="shrink-0 mx-5 mt-3 bg-green-900/50 border border-green-700 text-green-200 px-4 py-3 rounded-lg text-sm">
                    {success}
                </div>
            )}

            {/* Main content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Form panel */}
                <div className={`overflow-y-auto p-5 space-y-6 ${showPreview ? 'flex-1' : 'w-full'}`}>
                    {/* Validation Banner */}
                    <ValidationBanner issues={validationIssues} />

                    {/* Gateway Section */}
                    <FormSection
                        title="Gateway 网关"
                        description="服务端口、认证方式配置"
                    >
                        <GatewayFields
                            gateway={config?.gateway}
                            onChange={updateGateway}
                        />
                    </FormSection>

                    {/* Models Section */}
                    <FormSection
                        title="模型提供商 (Models)"
                        description="AI 模型网关，支持 OpenAI、Anthropic、Gemini 等"
                        action={
                            <button
                                onClick={() => setShowAddProvider(true)}
                                className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                            >
                                + 添加提供商
                            </button>
                        }
                    >
                        {showAddProvider && (
                            <div className="mb-4 bg-gray-800 border border-gray-700 rounded-lg p-4">
                                <FieldGroup label="提供商名称">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newProviderName}
                                            onChange={(e) => setNewProviderName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addProvider()}
                                            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                                            placeholder="例如: openai, anthropic"
                                            autoFocus
                                        />
                                        <button
                                            onClick={addProvider}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                                        >
                                            添加
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowAddProvider(false)
                                                setNewProviderName('')
                                            }}
                                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                                        >
                                            取消
                                        </button>
                                    </div>
                                </FieldGroup>
                            </div>
                        )}

                        {providerEntries.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 bg-gray-800/30 rounded-lg border border-gray-700 border-dashed">
                                <p className="text-sm">暂无提供商</p>
                                <p className="text-xs mt-1">点击「添加提供商」开始配置</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {providerEntries.map(([name, provider]) => (
                                    <ProviderCard
                                        key={name}
                                        name={name}
                                        provider={provider}
                                        isDefault={defaultProviderId === name}
                                        onUpdate={(updates) => updateProvider(name, updates)}
                                        onRemove={() => removeProvider(name)}
                                        onSetDefault={() => updateAgentDefaultModel(name)}
                                    />
                                ))}
                            </div>
                        )}
                    </FormSection>

                    {/* Agents Section */}
                    <FormSection
                        title="智能体 (Agents)"
                        description="默认智能体配置"
                    >
                        <div className="space-y-4 bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                            <FieldGroup label="默认工作空间" description="智能体的工作目录">
                                <input
                                    type="text"
                                    value={config?.agents?.defaults?.workspace || ''}
                                    onChange={(e) => updateAgentWorkspace(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                                    placeholder="~/openclaw-workspace"
                                />
                            </FieldGroup>

                            <FieldGroup label="默认模型" description="格式: provider/model">
                                <input
                                    type="text"
                                    value={config?.agents?.defaults?.model?.primary || ''}
                                    onChange={(e) => updateAgentDefaultModel(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                                    placeholder="openai/gpt-4"
                                />
                            </FieldGroup>
                        </div>
                    </FormSection>

                    {/* Canvas Section */}
                    <CanvasSection
                        canvasHost={config?.canvasHost}
                        setCanvasEnabled={setCanvasEnabled}
                        setCanvasPort={setCanvasPort}
                    />

                    {/* WhatsApp Section */}
                    <WhatsAppSection
                        config={config}
                        setWaGroupPolicy={setWaGroupPolicy}
                        setWaAllowFrom={setWaAllowFrom}
                        setWaRequireMention={setWaRequireMention}
                    />

                    {/* Messages Section */}
                    <FormSection
                        title="消息规则 (Messages)"
                        description="群聊中触发 AI 智能体响应的 @ 关键词列表"
                    >
                        <TagInput
                            values={config?.messages?.groupChat?.mentionPatterns ?? []}
                            onChange={setMentionPatterns}
                            placeholder="@openclaw，按 Enter 添加"
                        />
                    </FormSection>

                    {/* Environment Variables Section */}
                    <FormSection
                        title="环境变量 (Env)"
                        description="全局环境变量配置"
                    >
                        <EnvVarsSection
                            env={config?.env}
                            onChange={updateEnv}
                        />
                    </FormSection>
                </div>

                {/* Resize handle */}
                {showPreview && (
                    <div
                        onMouseDown={handleDragStart}
                        className="w-1 bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors"
                    />
                )}

                {/* Right: JSON panel */}
                {showPreview && (
                    <div
                        className="shrink-0 flex flex-col bg-gray-900 border-l border-gray-700"
                        style={{ width: `${panelWidth}px` }}
                    >
                        <div className="shrink-0 px-4 py-2 border-b border-gray-700 flex items-center justify-between bg-gray-800/60">
                            <span className="text-xs text-gray-400 font-mono">openclaw.json</span>
                            <span className="text-xs text-gray-500">{jsonText.split('\n').length} 行</span>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <textarea
                                value={jsonText}
                                onChange={(e) => handleJsonChange(e.target.value)}
                                onFocus={() => { editorFocused.current = true }}
                                onBlur={() => { editorFocused.current = false }}
                                className="w-full h-full bg-gray-950 text-gray-300 font-mono text-xs p-4 focus:outline-none resize-none"
                                spellCheck={false}
                            />
                        </div>
                        {jsonError && (
                            <div className="shrink-0 px-4 py-2 bg-red-900/50 border-t border-red-700 text-red-200 text-xs">
                                JSON 错误: {jsonError}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-5 py-2 border-t border-gray-700 flex items-center justify-between bg-gray-800/60">
                <div className="flex items-center gap-3 text-xs">
                    {isDirty && <span className="text-yellow-400">● 未保存的更改</span>}
                    {saveStatus === 'saved' && <span className="text-green-400">✓ 已保存</span>}
                    {providerEntries.length > 0 && (
                        <span className="text-gray-500">
                            {providerEntries.length} 个提供商
                        </span>
                    )}
                </div>
                <div className="text-xs text-gray-500 font-mono">
                    ~/.openclaw/openclaw.json
                </div>
            </div>
        </div>
    )
}
