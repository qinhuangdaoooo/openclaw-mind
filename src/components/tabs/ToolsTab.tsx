'use client'

import { useState, useEffect } from 'react'
import { envToolApi, EnvToolCheckResult } from '@/lib/tauri'

const tools = [
    { id: 'node', name: 'Node.js', icon: '🟢', description: 'JavaScript 运行时环境' },
    { id: 'python', name: 'Python', icon: '🐍', description: 'Python 编程语言' },
    { id: 'docker', name: 'Docker', icon: '🐳', description: '容器化平台' },
    { id: 'git', name: 'Git', icon: '📦', description: '版本控制系统' },
    { id: 'openclaw', name: 'OpenClaw CLI', icon: '🦞', description: 'OpenClaw 命令行工具' },
]

export default function ToolsTab() {
    const [results, setResults] = useState<Record<string, EnvToolCheckResult>>({})
    const [loading, setLoading] = useState<Record<string, boolean>>({})
    const [installing, setInstalling] = useState<string | null>(null)
    const [installProgress, setInstallProgress] = useState(0)
    const [installLogs, setInstallLogs] = useState<string[]>([])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // 监听安装日志
        const logUnlisten = envToolApi.onInstallLog((log) => {
            setInstallLogs((prev) => [...prev, log])
        })

        // 监听安装进度
        const progressUnlisten = envToolApi.onInstallProgress((progress) => {
            setInstallProgress(progress)
        })

        return () => {
            logUnlisten.then((fn) => fn())
            progressUnlisten.then((fn) => fn())
        }
    }, [])

    const checkTool = async (toolId: string) => {
        setLoading((prev) => ({ ...prev, [toolId]: true }))
        setError(null)
        try {
            const result = await envToolApi.check(toolId)
            setResults((prev) => ({ ...prev, [toolId]: result }))
        } catch (err) {
            setError(String(err))
        } finally {
            setLoading((prev) => ({ ...prev, [toolId]: false }))
        }
    }

    const checkAllTools = async () => {
        for (const tool of tools) {
            await checkTool(tool.id)
        }
    }

    const installTool = async (toolId: string) => {
        setInstalling(toolId)
        setInstallProgress(0)
        setInstallLogs([])
        setError(null)

        try {
            await envToolApi.install(toolId)
            // 安装完成后重新检测
            await checkTool(toolId)
        } catch (err) {
            setError(String(err))
        } finally {
            setInstalling(null)
            setInstallProgress(0)
        }
    }

    const clearLogs = () => {
        setInstallLogs([])
    }

    return (
        <div className="flex-1 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">环境配置</h1>
                        <p className="text-gray-400 text-sm">检测和管理开发环境工具</p>
                    </div>
                    <button
                        onClick={checkAllTools}
                        disabled={Object.values(loading).some((l) => l) || installing !== null}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                        🔍 检测所有工具
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Tools List */}
                    <div className="space-y-4">
                        {tools.map((tool) => {
                            const result = results[tool.id]
                            const isLoading = loading[tool.id]
                            const isInstalling = installing === tool.id

                            return (
                                <div
                                    key={tool.id}
                                    className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-colors"
                                >
                                    <div className="flex items-start gap-4">
                                        <span className="text-3xl">{tool.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-white mb-1">{tool.name}</h3>
                                            <p className="text-gray-400 text-sm mb-2">{tool.description}</p>

                                            {/* Status */}
                                            {result ? (
                                                result.found ? (
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-green-400 text-sm">✓ 已安装</span>
                                                        {result.version && (
                                                            <span className="text-gray-400 text-sm">{result.version}</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-red-400 text-sm block mb-2">✗ 未安装</span>
                                                )
                                            ) : (
                                                <span className="text-gray-500 text-sm block mb-2">未检测</span>
                                            )}

                                            {/* Progress Bar */}
                                            {isInstalling && (
                                                <div className="mb-2">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs text-gray-400">安装中...</span>
                                                        <span className="text-xs text-gray-400">{installProgress}%</span>
                                                    </div>
                                                    <div className="w-full bg-gray-700 rounded-full h-2">
                                                        <div
                                                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                                            style={{ width: `${installProgress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => checkTool(tool.id)}
                                                    disabled={isLoading || isInstalling}
                                                    className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white px-3 py-1.5 rounded-lg transition-colors text-sm"
                                                >
                                                    {isLoading ? '检测中...' : '检测'}
                                                </button>
                                                {result && !result.found && (
                                                    <button
                                                        onClick={() => installTool(tool.id)}
                                                        disabled={isLoading || isInstalling}
                                                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white px-3 py-1.5 rounded-lg transition-colors text-sm"
                                                    >
                                                        {isInstalling ? '安装中...' : '安装'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Right: Installation Logs */}
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex flex-col h-[600px]">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-white">安装日志</h3>
                            {installLogs.length > 0 && (
                                <button
                                    onClick={clearLogs}
                                    className="text-gray-400 hover:text-white text-sm transition-colors"
                                >
                                    清空
                                </button>
                            )}
                        </div>
                        <div className="flex-1 bg-gray-900 rounded-lg p-3 overflow-y-auto font-mono text-sm">
                            {installLogs.length === 0 ? (
                                <div className="text-gray-500 text-center py-8">
                                    暂无日志
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {installLogs.map((log, index) => (
                                        <div key={index} className="text-gray-300">
                                            <span className="text-gray-600">[{new Date().toLocaleTimeString()}]</span>{' '}
                                            {log}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Info */}
                <div className="mt-6 bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl">ℹ️</span>
                        <div className="flex-1 text-sm text-blue-200">
                            <p className="font-semibold mb-2">安装说明</p>
                            <ul className="list-disc list-inside space-y-1 text-blue-300">
                                <li>Node.js、Python、Git 使用 winget 自动安装（需要 Windows 10/11）</li>
                                <li>Docker Desktop 需要手动下载安装</li>
                                <li>OpenClaw CLI 通过 npm 安装（需要先安装 Node.js）</li>
                                <li>安装完成后可能需要重启终端或系统才能生效</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
