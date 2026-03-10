'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { envToolApi } from '@/lib/tauri'

type ItemStatus = 'idle' | 'checking' | 'found' | 'not-found' | 'installing' | 'uninstalling' | 'error'

interface ItemState {
    status: ItemStatus
    version?: string
    error?: string
}

interface LogEntry {
    type: 'info' | 'stdout' | 'stderr' | 'error'
    message: string
}

const LOG_COLORS: Record<LogEntry['type'], string> = {
    info: 'text-sky-400',
    stdout: 'text-zinc-300',
    stderr: 'text-amber-400',
    error: 'text-red-400',
}

export default function ConnectTab() {
    const router = useRouter()
    const [node, setNode] = useState<ItemState>({ status: 'idle' })
    const [openclaw, setOpenclaw] = useState<ItemState>({ status: 'idle' })
    const [logs, setLogs] = useState<LogEntry[]>([])
    const logRef = useRef<HTMLDivElement>(null)

    const pushLog = (entry: LogEntry) => {
        setLogs((prev) => [...prev, entry])
    }

    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight
        }
    }, [logs])

    useEffect(() => {
        // 自动检测
        checkNode()
    }, [])

    const checkNode = async () => {
        setNode({ status: 'checking' })
        try {
            const result = await envToolApi.check('node')
            setNode({
                status: result.found ? 'found' : 'not-found',
                version: result.version,
            })
            if (result.found) {
                await checkOpenclaw()
            }
        } catch (err) {
            setNode({ status: 'error', error: String(err) })
        }
    }

    const checkOpenclaw = async () => {
        setOpenclaw({ status: 'checking' })
        try {
            const result = await envToolApi.check('openclaw')
            setOpenclaw({
                status: result.found ? 'found' : 'not-found',
                version: result.version,
            })
        } catch (err) {
            setOpenclaw({ status: 'error', error: String(err) })
        }
    }

    const installNode = async () => {
        setNode({ status: 'installing' })
        setLogs([])
        pushLog({ type: 'info', message: '开始安装 Node.js LTS...' })

        try {
            await envToolApi.install('node')
            pushLog({ type: 'info', message: '✓ Node.js 安装成功' })
            await checkNode()
        } catch (err) {
            pushLog({ type: 'error', message: `✗ 安装失败: ${String(err)}` })
            setNode({ status: 'error', error: '安装失败，请查看日志' })
        }
    }

    const installOpenclaw = async () => {
        setOpenclaw({ status: 'installing' })
        setLogs([])
        pushLog({ type: 'info', message: '开始安装 OpenClaw CLI...' })

        try {
            await envToolApi.install('openclaw')
            pushLog({ type: 'info', message: '✓ OpenClaw CLI 安装成功' })
            await checkOpenclaw()

            // 跳转到配置页面
            setTimeout(() => {
                router.push('/?tab=config')
            }, 1500)
        } catch (err) {
            pushLog({ type: 'error', message: `✗ 安装失败: ${String(err)}` })
            setOpenclaw({ status: 'error', error: '安装失败，请查看日志' })
        }
    }

    const uninstallNode = async () => {
        setNode({ status: 'uninstalling' })
        setLogs([])
        pushLog({ type: 'info', message: '开始卸载 Node.js...' })

        try {
            await envToolApi.uninstall('node')
            pushLog({ type: 'info', message: '✓ Node.js 卸载成功' })
            setNode({ status: 'not-found' })
            setOpenclaw({ status: 'idle' })
        } catch (err) {
            pushLog({ type: 'error', message: `✗ 卸载失败: ${String(err)}` })
            setNode({ status: 'error', error: '卸载失败' })
        }
    }

    const uninstallOpenclaw = async () => {
        setOpenclaw({ status: 'uninstalling' })
        setLogs([])
        pushLog({ type: 'info', message: '开始卸载 OpenClaw CLI...' })

        try {
            await envToolApi.uninstall('openclaw')
            pushLog({ type: 'info', message: '✓ OpenClaw CLI 卸载成功' })
            setOpenclaw({ status: 'not-found' })
        } catch (err) {
            pushLog({ type: 'error', message: `✗ 卸载失败: ${String(err)}` })
            setOpenclaw({ status: 'error', error: '卸载失败' })
        }
    }

    const nodeFound = node.status === 'found'
    const isComplete = nodeFound && openclaw.status === 'found'
    const isBusy = node.status === 'installing' || node.status === 'uninstalling' ||
        openclaw.status === 'installing' || openclaw.status === 'uninstalling'

    return (
        <div className="flex-1 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-white mb-1">安装与连接</h1>
                    <p className="text-gray-400 text-sm">
                        自动检测并安装 Node.js LTS 和 OpenClaw CLI，完成后可前往配置页面设置 AI 模型。
                    </p>
                </div>

                {/* Installation Steps */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    {/* Step 1: Node.js */}
                    <ToolCard
                        step={1}
                        title="Node.js"
                        subtitle="运行时环境（LTS 版本）"
                        state={node}
                        disabled={isBusy}
                        onInstall={installNode}
                        onUninstall={uninstallNode}
                        onRecheck={checkNode}
                    />

                    {/* Step 2: OpenClaw CLI */}
                    <ToolCard
                        step={2}
                        title="OpenClaw CLI"
                        subtitle="openclaw@latest（全局安装）"
                        state={openclaw}
                        disabled={isBusy || !nodeFound}
                        onInstall={installOpenclaw}
                        onUninstall={uninstallOpenclaw}
                        onRecheck={checkOpenclaw}
                    />
                </div>

                {/* Completion Banner */}
                {isComplete && (
                    <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs">
                                ✓
                            </div>
                            <div>
                                <div className="text-sm font-medium text-white">安装完成</div>
                                <div className="text-xs text-gray-400 mt-0.5">
                                    前往配置页面设置 AI 模型和 API Key
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => router.push('/?tab=config')}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors"
                        >
                            ⚙️ 去配置
                            <span>→</span>
                        </button>
                    </div>
                )}

                {/* Log Panel */}
                {logs.length > 0 && (
                    <div className="rounded-xl border border-gray-700 bg-gray-950 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900/80">
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span>📟</span>
                                <span>输出日志</span>
                            </div>
                            <button
                                onClick={() => setLogs([])}
                                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                            >
                                清空
                            </button>
                        </div>
                        <div
                            ref={logRef}
                            className="p-4 max-h-64 overflow-y-auto font-mono text-xs leading-relaxed space-y-0.5"
                        >
                            {logs.map((log, i) => (
                                <div key={i} className={LOG_COLORS[log.type]}>
                                    {log.message}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// Tool Card Component
interface ToolCardProps {
    step: number
    title: string
    subtitle: string
    state: ItemState
    disabled: boolean
    onInstall: () => void
    onUninstall: () => void
    onRecheck: () => void
}

function ToolCard({ step, title, subtitle, state, disabled, onInstall, onUninstall, onRecheck }: ToolCardProps) {
    const { status, version, error } = state
    const isNotFound = status === 'not-found'
    const isError = status === 'error'
    const isBusy = status === 'installing' || status === 'uninstalling' || status === 'checking'

    const borderColor =
        status === 'found'
            ? 'border-emerald-500/40 bg-emerald-500/5'
            : isNotFound || isError
                ? 'border-gray-700 bg-gray-800/30'
                : 'border-gray-700 bg-gray-800'

    return (
        <div className={`rounded-xl border p-5 flex flex-col gap-4 transition-colors ${borderColor}`}>
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${status === 'found' ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-400'
                            }`}
                    >
                        {step}
                    </div>
                    <div>
                        <div className="font-semibold text-sm text-white">{title}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>
                    </div>
                </div>
                <StatusIcon status={status} />
            </div>

            {version && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                    <span>✓</span>
                    {version}
                </div>
            )}

            {error && (
                <div className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>
            )}

            {status === 'idle' && (
                <p className="text-xs text-gray-500">点击检查按钮以检测安装状态</p>
            )}
            {status === 'checking' && (
                <p className="text-xs text-gray-400 animate-pulse">正在检测...</p>
            )}
            {status === 'installing' && (
                <p className="text-xs text-gray-400 animate-pulse">安装中，请稍候...</p>
            )}
            {status === 'uninstalling' && (
                <p className="text-xs text-gray-400 animate-pulse">卸载中，请稍候...</p>
            )}

            <div className="flex gap-2 mt-auto">
                {(isNotFound || isError) && (
                    <button
                        onClick={onInstall}
                        disabled={disabled || isBusy}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <span>📥</span>
                        {isError ? '重试安装' : '立即安装'}
                    </button>
                )}

                {status === 'found' && (
                    <button
                        onClick={onUninstall}
                        disabled={isBusy}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <span>🗑️</span>
                        卸载
                    </button>
                )}

                <button
                    onClick={onRecheck}
                    disabled={isBusy}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-700 text-gray-300 text-xs font-medium hover:bg-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <span>🔄</span>
                    重新检测
                </button>
            </div>
        </div>
    )
}

function StatusIcon({ status }: { status: ItemStatus }) {
    switch (status) {
        case 'checking':
        case 'installing':
        case 'uninstalling':
            return (
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )
        case 'found':
            return <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs">✓</div>
        case 'not-found':
            return <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
        case 'error':
            return <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">✗</div>
        default:
            return <div className="w-5 h-5 rounded-full border-2 border-gray-700" />
    }
}
