'use client'

import { useCallback, useEffect, useState } from 'react'
import { agentApi } from '@/lib/tauri'

// 配置文件列表
interface FileTab {
    id: string
    label: string
    icon: string
    description: string
}

const TABS: FileTab[] = [
    { id: 'IDENTITY.md', label: 'IDENTITY', icon: '🆔', description: 'AI 助手的身份信息' },
    { id: 'SOUL.md', label: 'SOUL', icon: '🤖', description: 'AI 助手的性格说明书' },
    { id: 'USER.md', label: 'USER', icon: '👤', description: '写给助手看的自我介绍' },
    { id: 'AGENTS.md', label: 'AGENTS', icon: '📄', description: '助手工作方式与边界' },
    { id: 'MEMORY.md', label: 'MEMORY', icon: '🧠', description: '长期记忆精华' },
]

export default function IdentitySkillsTab() {
    const [activeTab, setActiveTab] = useState<string>('IDENTITY.md')
    const [contents, setContents] = useState<Record<string, string>>({
        'IDENTITY.md': '',
        'SOUL.md': '',
        'USER.md': '',
        'AGENTS.md': '',
        'MEMORY.md': '',
    })
    const [loaded, setLoaded] = useState<Record<string, boolean>>({
        'IDENTITY.md': false,
        'SOUL.md': false,
        'USER.md': false,
        'AGENTS.md': false,
        'MEMORY.md': false,
    })
    const [saving, setSaving] = useState(false)
    const [savedTab, setSavedTab] = useState<string | null>(null)
    const [workspace] = useState('~/.openclaw/workspace')

    // 加载文件
    const loadFile = useCallback(async (filename: string) => {
        try {
            const content = await agentApi.readWorkspaceFile(workspace, filename)
            setContents((prev) => ({ ...prev, [filename]: content }))
        } catch (err) {
            console.error(`Failed to load ${filename}:`, err)
        } finally {
            setLoaded((prev) => ({ ...prev, [filename]: true }))
        }
    }, [workspace])

    // 初始加载所有文件
    useEffect(() => {
        for (const tab of TABS) {
            loadFile(tab.id)
        }
    }, [loadFile])

    // 保存文件
    const handleSave = async () => {
        if (saving) return

        setSaving(true)
        try {
            await agentApi.writeWorkspaceFile(workspace, activeTab, contents[activeTab])
            setSavedTab(activeTab)
            setTimeout(() => setSavedTab(null), 2000)
        } catch (err) {
            console.error('Failed to save:', err)
            alert(`保存失败: ${String(err)}`)
        } finally {
            setSaving(false)
        }
    }

    // Ctrl/Cmd + S 保存
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault()
                handleSave()
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [activeTab, contents, saving])

    const currentTab = TABS.find((t) => t.id === activeTab)!
    const isCurrentLoaded = loaded[activeTab]

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 shrink-0 border-b border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-xl font-bold text-white mb-1">身份配置</h1>
                        <p className="text-xs text-gray-400">
                            <code className="bg-gray-800 px-1.5 py-0.5 rounded font-mono">
                                ~/.openclaw/workspace/
                            </code>
                            <span className="ml-1.5">AI 助手配置文件</span>
                        </p>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving || !isCurrentLoaded}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm transition-colors disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <span className="animate-spin">⏳</span>
                                保存中
                            </>
                        ) : savedTab === activeTab ? (
                            <>
                                <span>✓</span>
                                已保存
                            </>
                        ) : (
                            <>
                                <span>💾</span>
                                保存
                            </>
                        )}
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1">
                    {TABS.map((tab) => {
                        const isActive = activeTab === tab.id

                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${isActive
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                                    }`}
                            >
                                <span className="text-sm">{tab.icon}</span>
                                {tab.label}
                                {!loaded[tab.id] && (
                                    <span className="animate-spin opacity-50">⏳</span>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Description bar */}
            <div className="flex items-center justify-between px-6 py-2 shrink-0 border-b border-gray-700 bg-gray-800/30">
                <div className="flex items-center gap-1.5">
                    <span className="text-base">{currentTab.icon}</span>
                    <span className="text-xs text-gray-400">{currentTab.description}</span>
                </div>
                <code className="text-[10px] text-gray-500 font-mono">
                    ~/.openclaw/workspace/{activeTab}
                </code>
            </div>

            {/* Editor */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                {!isCurrentLoaded ? (
                    <div className="flex h-full items-center justify-center">
                        <div className="animate-spin text-2xl">⏳</div>
                    </div>
                ) : (
                    <div className="p-6">
                        <textarea
                            value={contents[activeTab]}
                            onChange={(e) =>
                                setContents((prev) => ({ ...prev, [activeTab]: e.target.value }))
                            }
                            className="w-full h-[calc(100vh-300px)] bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-blue-500 resize-none"
                            placeholder={`编辑 ${activeTab}...`}
                            spellCheck={false}
                        />
                        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                            <span>
                                {contents[activeTab].length} 字符 · {contents[activeTab].split('\n').length} 行
                            </span>
                            <span>按 Ctrl/Cmd + S 保存</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
