'use client'

import { useEffect, useMemo, useState } from 'react'
import { configApi, type OpenclawConfig } from '@/lib/tauri'
import { FormSection } from '@/components/config/FormSection'

function formatJson(value: unknown) {
    return JSON.stringify(value ?? {}, null, 2)
}

function parseSection(text: string, label: string) {
    const trimmed = text.trim()
    if (!trimmed) return undefined

    try {
        return JSON.parse(trimmed)
    } catch (error) {
        throw new Error(`${label} 配置不是有效 JSON: ${String(error)}`)
    }
}

export default function ChatToolsTab() {
    const [config, setConfig] = useState<OpenclawConfig | null>(null)
    const [feishuText, setFeishuText] = useState('{}')
    const [bridgeText, setBridgeText] = useState('{}')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    useEffect(() => {
        loadConfig()
    }, [])

    const loadConfig = async () => {
        setLoading(true)
        setError(null)
        try {
            const nextConfig = await configApi.read()
            setConfig(nextConfig)
            setFeishuText(formatJson(nextConfig.channels?.feishu))
            setBridgeText(formatJson(nextConfig.channels?.qqBridge))
        } catch (err) {
            setError(String(err))
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!config) return

        setSaving(true)
        setError(null)
        setSuccess(null)

        try {
            const feishu = parseSection(feishuText, '飞书')
            const qqBridge = parseSection(bridgeText, '请求桥接')

            const nextConfig: OpenclawConfig = {
                ...config,
                channels: {
                    ...(config.channels ?? {}),
                    ...(feishu === undefined ? {} : { feishu }),
                    ...(qqBridge === undefined ? {} : { qqBridge }),
                },
            }

            await configApi.write(nextConfig)
            setConfig(nextConfig)
            setSuccess('聊天工具配置已保存')
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            setError(String(err))
        } finally {
            setSaving(false)
        }
    }

    const feishuEnabled = useMemo(() => {
        try {
            const parsed = parseSection(feishuText, '飞书')
            return parsed && typeof parsed === 'object' ? (parsed as any).enabled !== false : false
        } catch {
            return false
        }
    }, [feishuText])

    const bridgeEnabled = useMemo(() => {
        try {
            const parsed = parseSection(bridgeText, '请求桥接')
            return parsed && typeof parsed === 'object' ? (parsed as any).enabled !== false : false
        } catch {
            return false
        }
    }, [bridgeText])

    if (loading && !config) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-gray-400">加载聊天工具配置中...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">聊天工具管理</h1>
                        <p className="text-sm text-gray-400">
                            将飞书与请求桥接从通用配置里拆出来单独管理，保存时仍写回 <span className="font-mono">~/.openclaw/openclaw.json</span>。
                        </p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving || loading || !config}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm transition-colors"
                    >
                        {saving ? '保存中...' : '保存配置'}
                    </button>
                </div>

                {(error || success) && (
                    <div className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-700 bg-red-900/30 text-red-200' : 'border-green-700 bg-green-900/30 text-green-200'}`}>
                        {error || success}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
                        <div className="text-xs text-gray-500 mb-2">状态</div>
                        <div className="flex items-center gap-2 text-white">
                            <span className={`inline-block w-2.5 h-2.5 rounded-full ${feishuEnabled ? 'bg-emerald-500' : 'bg-gray-600'}`} />
                            飞书
                        </div>
                    </div>
                    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
                        <div className="text-xs text-gray-500 mb-2">状态</div>
                        <div className="flex items-center gap-2 text-white">
                            <span className={`inline-block w-2.5 h-2.5 rounded-full ${bridgeEnabled ? 'bg-emerald-500' : 'bg-gray-600'}`} />
                            请求桥接
                        </div>
                    </div>
                </div>

                <FormSection
                    title="飞书"
                    description="编辑 channels.feishu。当前你的本地配置已经包含飞书账号信息，这里会原样保留未改动字段。"
                >
                    <textarea
                        value={feishuText}
                        onChange={(e) => setFeishuText(e.target.value)}
                        spellCheck={false}
                        className="w-full min-h-80 bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-blue-500 resize-y"
                    />
                </FormSection>

                <FormSection
                    title="请求桥接"
                    description="编辑 channels.qqBridge。这里专门用于桥接类聊天工具配置，避免继续混在通用配置页里。"
                >
                    <textarea
                        value={bridgeText}
                        onChange={(e) => setBridgeText(e.target.value)}
                        spellCheck={false}
                        className="w-full min-h-80 bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-blue-500 resize-y"
                    />
                </FormSection>
            </div>
        </div>
    )
}
