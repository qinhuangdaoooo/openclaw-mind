'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { skillApi, Skill, systemApi } from '@/lib/tauri'

type CategoryId = 'all' | 'runtime' | 'tool' | 'builtin' | 'extension'

const CATEGORY_LABELS: Record<CategoryId, string> = {
    all: '全部',
    runtime: '运行时',
    tool: '本机工具',
    builtin: '内置技能',
    extension: '扩展技能',
}

function getCategory(skill: Skill): CategoryId {
    switch (skill.category) {
        case 'runtime':
        case 'tool':
        case 'builtin':
        case 'extension':
            return skill.category
        default:
            return 'builtin'
    }
}

function getKindLabel(skill: Skill): string {
    switch (skill.kind) {
        case 'computer-use':
            return '电脑操作'
        case 'tts':
            return 'TTS'
        case 'stt':
            return '语音识别'
        case 'browser-control':
            return '浏览器控制'
        case 'command-execution':
            return '命令执行'
        case 'plugin':
            return '插件'
        case 'native-tool':
            return '工具'
        case 'builtin-skill':
            return '内置'
        case 'extension-skill':
            return '扩展'
        default:
            return skill.kind || '能力'
    }
}

export default function BuiltinSkillsTab() {
    const [skills, setSkills] = useState<Skill[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [activeCategory, setActiveCategory] = useState<CategoryId>('all')

    const loadSkills = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const list = await skillApi.listBuiltin()
            setSkills(list)
        } catch (err) {
            setError(String(err))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadSkills()
    }, [loadSkills])

    const filteredSkills = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        return skills.filter((skill) => {
            const categoryMatch = activeCategory === 'all' || getCategory(skill) === activeCategory
            if (!categoryMatch) return false
            if (!query) return true

            const haystack = [
                skill.name,
                skill.description,
                skill.kind,
                skill.origin,
                ...(skill.tags ?? []),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()

            return haystack.includes(query)
        })
    }, [activeCategory, searchQuery, skills])

    const summary = useMemo(() => {
        return {
            total: skills.length,
            runtime: skills.filter((skill) => getCategory(skill) === 'runtime').length,
            tool: skills.filter((skill) => getCategory(skill) === 'tool').length,
            builtin: skills.filter((skill) => getCategory(skill) === 'builtin').length,
            extension: skills.filter((skill) => getCategory(skill) === 'extension').length,
        }
    }, [skills])

    const openLocation = async (skill: Skill) => {
        if (!skill.location) return
        try {
            await systemApi.openPathInFinder(skill.location)
        } catch (err) {
            alert(`无法打开路径: ${String(err)}`)
        }
    }

    return (
        <div className="flex-1 flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-6xl mx-auto space-y-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-bold text-white mb-1">内置能力</h1>
                            <p className="text-sm text-gray-400">
                                这里会同步当前 OpenClaw 的内置技能、扩展、本机工具和运行时能力。
                            </p>
                        </div>
                        <button
                            onClick={loadSkills}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors disabled:opacity-40"
                        >
                            <span className={loading ? 'animate-spin' : ''}>↻</span>
                            刷新
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {(['all', 'runtime', 'tool', 'builtin', 'extension'] as CategoryId[]).map((category) => {
                            const count = category === 'all' ? summary.total : summary[category]
                            const active = activeCategory === category
                            return (
                                <button
                                    key={category}
                                    onClick={() => setActiveCategory(category)}
                                    className={`rounded-xl border px-4 py-3 text-left transition-colors ${active ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'}`}
                                >
                                    <div className="text-xs text-gray-400">{CATEGORY_LABELS[category]}</div>
                                    <div className="text-lg font-semibold mt-1">{count}</div>
                                </button>
                            )
                        })}
                    </div>

                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">⌕</span>
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="搜索能力名、标签、来源..."
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-700 bg-gray-900 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                    </div>

                    {error && (
                        <div className="rounded-lg border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-200">
                            {error}
                        </div>
                    )}

                    {loading && skills.length === 0 ? (
                        <div className="text-center py-16 text-gray-500">正在同步能力...</div>
                    ) : filteredSkills.length === 0 ? (
                        <div className="text-center py-16 text-gray-500">没有匹配到能力</div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {filteredSkills.map((skill) => (
                                <div key={`${skill.name}-${skill.kind}-${skill.origin}`} className="rounded-xl border border-gray-700 bg-gray-800 p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h2 className="text-sm font-semibold text-white">{skill.name}</h2>
                                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-900/40 text-sky-300">
                                                    {getKindLabel(skill)}
                                                </span>
                                                {skill.enabled !== undefined && (
                                                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${skill.enabled ? 'bg-emerald-900/40 text-emerald-300' : 'bg-gray-700 text-gray-300'}`}>
                                                        {skill.enabled ? '已启用' : '未启用'}
                                                    </span>
                                                )}
                                            </div>
                                            {skill.description && (
                                                <p className="text-sm text-gray-400 mt-2 leading-relaxed">{skill.description}</p>
                                            )}
                                        </div>
                                        {skill.location && (
                                            <button
                                                onClick={() => openLocation(skill)}
                                                className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors"
                                            >
                                                打开位置
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-2 text-xs text-gray-400">
                                        {skill.origin && <div>来源: <span className="text-gray-300">{skill.origin}</span></div>}
                                        {skill.location && <div className="font-mono truncate">路径: {skill.location}</div>}
                                        {skill.tags && skill.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                                {skill.tags.map((tag) => (
                                                    <span key={tag} className="px-2 py-0.5 rounded-full bg-gray-900 text-gray-300">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
