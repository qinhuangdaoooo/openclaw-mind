'use client'

import { useState, useEffect, useCallback } from 'react'
import { skillApi, Skill, systemApi } from '@/lib/tauri'

export default function BuiltinSkillsTab() {
    const [skills, setSkills] = useState<Skill[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [skillsDir, setSkillsDir] = useState('')

    // 加载内置技能
    const loadSkills = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            // 调用后端命令列出内置技能
            const list = await skillApi.listBuiltin()
            setSkills(list)

            // 设置目录路径（从第一个技能的路径推断）
            if (list.length > 0) {
                // 假设内置技能在 npm 全局目录
                setSkillsDir('npm 全局包 / openclaw / skills')
            }
        } catch (err) {
            setError(String(err))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadSkills()
    }, [loadSkills])

    const handleRefresh = () => {
        loadSkills()
    }

    const handleOpenDirectory = async () => {
        if (!skillsDir) return
        try {
            // 尝试打开 npm 全局目录
            await systemApi.openPathInFinder(skillsDir)
        } catch (err) {
            console.error('Failed to open directory:', err)
            alert(`无法打开目录: ${String(err)}`)
        }
    }

    // 搜索过滤
    const filteredSkills = searchQuery
        ? skills.filter(
            (s) =>
                s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        : skills

    return (
        <div className="flex-1 flex flex-col h-full">
            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="mb-6 flex items-start justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-white mb-1">内置技能</h1>
                            <p className="text-sm text-gray-400">
                                随 openclaw 一同安装的内置技能（只读）
                            </p>
                        </div>
                        <button
                            onClick={handleRefresh}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors disabled:opacity-40"
                        >
                            <span className={loading ? 'animate-spin' : ''}>🔄</span>
                            刷新
                        </button>
                    </div>

                    {/* Search Bar */}
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
                            <p className="text-4xl mb-4">📦</p>
                            <p>
                                {searchQuery
                                    ? `未找到匹配 "${searchQuery}" 的技能`
                                    : '未找到内置技能'}
                            </p>
                            <p className="text-sm mt-2">请确认 openclaw 已全局安装</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredSkills.map((skill, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-start gap-3 px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 hover:bg-gray-700/30 transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <span className="text-lg">📦</span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-white font-mono">
                                            {skill.name}
                                        </p>
                                        {skill.description && (
                                            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed line-clamp-2">
                                                {skill.description}
                                            </p>
                                        )}
                                    </div>
                                    <span className="shrink-0 text-xs px-2 py-1 rounded bg-purple-900/50 text-purple-400">
                                        内置
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
