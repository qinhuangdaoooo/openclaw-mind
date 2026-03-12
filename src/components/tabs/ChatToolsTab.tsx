'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChannelTestResult, OpenclawConfig, configApi } from '@/lib/tauri'
import { ChannelIngestTester } from '@/components/config/ChannelIngestTester'
import { FeishuSection } from '@/components/config/FeishuSection'
import { QqBridgeSection } from '@/components/config/QqBridgeSection'

type FeishuChannelConfig = NonNullable<NonNullable<OpenclawConfig['channels']>['feishu']>
type QqBridgeChannelConfig = NonNullable<NonNullable<OpenclawConfig['channels']>['qqBridge']>

export default function ChatToolsTab() {
    const [config, setConfig] = useState<OpenclawConfig | null>(null)
    const [savedSnapshot, setSavedSnapshot] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
    const [testingChannel, setTestingChannel] = useState<'feishu' | 'qqBridge' | null>(null)
    const [feishuTestResult, setFeishuTestResult] = useState<ChannelTestResult | null>(null)
    const [qqBridgeTestResult, setQqBridgeTestResult] = useState<ChannelTestResult | null>(null)

    useEffect(() => {
        loadConfig()
    }, [])

    const loadConfig = async () => {
        setLoading(true)
        setError(null)
        try {
            const nextConfig = await configApi.read()
            setConfig(nextConfig)
            setSavedSnapshot(JSON.stringify(nextConfig))
        } catch (err) {
            setError(String(err))
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!config) {
            return
        }

        setSaveStatus('saving')
        setError(null)
        setSuccess(null)

        try {
            await configApi.write(config)
            setSavedSnapshot(JSON.stringify(config))
            setSaveStatus('saved')
            setSuccess('聊天工具配置已保存')
            setTimeout(() => {
                setSaveStatus('idle')
                setSuccess(null)
            }, 3000)
        } catch (err) {
            setError(String(err))
            setSaveStatus('idle')
        }
    }

    const updateFeishuChannel = (updates: Partial<FeishuChannelConfig>) => {
        if (!config) {
            return
        }

        setConfig({
            ...config,
            channels: {
                ...config.channels,
                feishu: {
                    enabled: config.channels?.feishu?.enabled ?? false,
                    groupPolicy: config.channels?.feishu?.groupPolicy ?? 'open',
                    allowChats: config.channels?.feishu?.allowChats ?? [],
                    requireMention: config.channels?.feishu?.requireMention ?? true,
                    ...config.channels?.feishu,
                    ...updates,
                },
            },
        })
    }

    const updateQqBridgeChannel = (updates: Partial<QqBridgeChannelConfig>) => {
        if (!config) {
            return
        }

        setConfig({
            ...config,
            channels: {
                ...config.channels,
                qqBridge: {
                    enabled: config.channels?.qqBridge?.enabled ?? false,
                    mode: config.channels?.qqBridge?.mode ?? 'http',
                    groupPolicy: config.channels?.qqBridge?.groupPolicy ?? 'open',
                    allowGroups: config.channels?.qqBridge?.allowGroups ?? [],
                    requireMention: config.channels?.qqBridge?.requireMention ?? true,
                    ...config.channels?.qqBridge,
                    ...updates,
                },
            },
        })
    }

    const handleTestFeishu = async () => {
        if (!config) {
            return
        }

        setTestingChannel('feishu')
        setFeishuTestResult(null)
        setError(null)

        try {
            setFeishuTestResult(await configApi.testFeishu(config))
        } catch (err) {
            setFeishuTestResult({
                success: false,
                message: '飞书连接测试失败',
                details: String(err),
            })
        } finally {
            setTestingChannel(null)
        }
    }

    const handleTestQqBridge = async () => {
        if (!config) {
            return
        }

        setTestingChannel('qqBridge')
        setQqBridgeTestResult(null)
        setError(null)

        try {
            setQqBridgeTestResult(await configApi.testQqBridge(config))
        } catch (err) {
            setQqBridgeTestResult({
                success: false,
                message: '请求桥接连接测试失败',
                details: String(err),
            })
        } finally {
            setTestingChannel(null)
        }
    }

    const isDirty = useMemo(() => {
        if (!config) {
            return false
        }

        return JSON.stringify(config) !== savedSnapshot
    }, [config, savedSnapshot])

    if (loading && !config) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-400">加载聊天工具配置中...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col h-full">
            <div className="shrink-0 px-5 py-3 border-b border-gray-700 flex items-center justify-between bg-gray-800/60">
                <div>
                    <h1 className="text-lg font-bold text-white">聊天工具管理</h1>
                    <p className="text-xs text-gray-400">集中管理飞书和请求桥接配置</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={loadConfig}
                        disabled={loading}
                        className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white rounded transition-colors"
                    >
                        重新加载
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!config || !isDirty || saveStatus === 'saving'}
                        className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded transition-colors"
                    >
                        {saveStatus === 'saving' ? '保存中...' : '保存配置'}
                    </button>
                </div>
            </div>

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

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
                <div className="rounded-xl border border-gray-700 bg-gray-800/30 px-4 py-3">
                    <p className="text-sm text-gray-200">
                        当前页面会直接读写 <code className="font-mono text-sky-300">~/.openclaw/openclaw.json</code> 中的渠道配置。
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        飞书和请求桥接的修改会保留你现有配置里的其他字段，不会覆盖掉 models、agents 等未展示部分。
                    </p>
                </div>

                <FeishuSection
                    value={config?.channels?.feishu}
                    onChange={updateFeishuChannel}
                    onTest={handleTestFeishu}
                    testing={testingChannel === 'feishu'}
                    testResult={feishuTestResult}
                />

                <ChannelIngestTester
                    config={config}
                    channel="feishu"
                    heading="测试飞书消息导入 Mind"
                    description="模拟一条飞书消息进入 Mind，验证当前会话参数和 bindings 是否能正确路由。"
                    peerIdLabel="会话 ID"
                    peerIdPlaceholder="chat_v2_xxx / ou_xxx"
                    senderIdPlaceholder="ou_xxx"
                    defaultPeerKind="group"
                    defaultPeerId={config?.channels?.feishu?.defaultChatId ?? config?.channels?.feishu?.allowChats?.[0]}
                />

                <QqBridgeSection
                    value={config?.channels?.qqBridge}
                    onChange={updateQqBridgeChannel}
                    onTest={handleTestQqBridge}
                    testing={testingChannel === 'qqBridge'}
                    testResult={qqBridgeTestResult}
                />

                <ChannelIngestTester
                    config={config}
                    channel="qqbridge"
                    heading="测试请求桥接消息导入 Mind"
                    description="模拟桥接层送入一条消息，确认群号或用户 ID 与 Agent 绑定是否生效。"
                    peerIdLabel="群号 / 用户 ID"
                    peerIdPlaceholder="123456789"
                    senderIdPlaceholder="发送者 ID"
                    defaultPeerKind="group"
                    defaultPeerId={config?.channels?.qqBridge?.allowGroups?.[0]}
                />
            </div>
        </div>
    )
}
