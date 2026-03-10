'use client'

import { useState, useEffect } from 'react'
import { skillApi, agentApi, type Agent } from '@/lib/tauri'

interface SkillInstallDialogProps {
    skillName: string
    skillSlug: string
    onClose: () => void
    onSuccess: () => void
}

export default function SkillInstallDialog({ skillName, skillSlug, onClose, onSuccess }: SkillInstallDialogProps) {
    const [agents, setAgents] = useState<Agent[]>([])
    const [selectedWorkspace, setSelectedWorkspace] = useState<string>('')
    const [installing, setInstalling] = useState(false)
    const [logs, setLogs] = useState<string[]>([])
    const [success, setSuccess] = useState<boolean | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadAgents()
    }, [])

    const loadAgents = async () => {
        try {
            const agentList = await agentApi.list()
            setAgents(agentList)
            if (agentList.length > 0 && agentList[0].workspace) {
                setSelectedWorkspace(agentList[0].workspace)
            }
        } catch (err) {
            console.error('Failed to load agents:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleInstall = async () => {
        if (!selectedWorkspace) return

        setInstalling(true)
        setLogs([])
        setSuccess(null)

        try {
            const unlisten = await skillApi.installStream(
                selectedWorkspace,
                skillSlug,
                (log) => {
                    setLogs(prev => [...prev, log])
                },
                (isSuccess) => {
                    setSuccess(isSuccess)
                    setInstalling(false)
                    if (isSuccess) {
                        setTimeout(() => {
                            onSuccess()
                            onClose()
                        }, 2000)
                    }
                }
            )

            // 清理监听器
            return () => {
                unlisten()
            }
        } catch (err) {
            setLogs(prev => [...prev, `错误: ${err}`])
            setSuccess(false)
            setInstalling(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b border-gray-700">
                    <h2 className="text-lg font-semibold text-white">安装技能</h2>
                    <p className="text-sm text-gray-400 mt-1">{skillName}</p>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {!installing && success === null && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    选择目标工作区
                                </label>
                                {loading ? (
                                    <div className="text-sm text-gray-400">加载中...</div>
                                ) : agents.length === 0 ? (
                                    <div className="text-sm text-red-400">未找到可用的 Agent 工作区</div>
                                ) : (
                                    <select
                                        value={selectedWorkspace}
                                        onChange={(e) => setSelectedWorkspace(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                    >
                                        {agents.map((agent) => (
                                            <option key={agent.id} value={agent.workspace || ''}>
                                                {agent.name || agent.id} ({agent.workspace})
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-sm text-blue-300">
                                <p className="font-medium mb-1">📦 技能信息</p>
                                <p>Slug: {skillSlug}</p>
                                <p className="mt-2 text-xs text-gray-400">
                                    技能将通过 @openclaw/cli 安装到选定的工作区
                                </p>
                            </div>
                        </>
                    )}

                    {(installing || logs.length > 0) && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-gray-300">安装日志</label>
                                {installing && (
                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                        <div className="w-3 h-3 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin"></div>
                                        安装中...
                                    </div>
                                )}
                            </div>
                            <div className="bg-gray-950 rounded-lg p-3 font-mono text-xs text-gray-300 max-h-64 overflow-y-auto">
                                {logs.length === 0 ? (
                                    <div className="text-gray-500">等待日志输出...</div>
                                ) : (
                                    logs.map((log, index) => (
                                        <div key={index} className="mb-1">
                                            {log}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {success !== null && (
                        <div className={`p-3 rounded-lg border ${success ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
                            <p className="font-medium">
                                {success ? '✓ 安装成功' : '✗ 安装失败'}
                            </p>
                            {success && (
                                <p className="text-xs mt-1 text-gray-400">窗口将自动关闭...</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-700 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        disabled={installing}
                        className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                        {success ? '关闭' : '取消'}
                    </button>
                    {!installing && success === null && (
                        <button
                            onClick={handleInstall}
                            disabled={!selectedWorkspace || loading}
                            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                            开始安装
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
