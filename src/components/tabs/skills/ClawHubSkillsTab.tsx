'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { clawhubApi, type Skill, type ClawHubSearchItem } from '@/lib/tauri'
import SkillInstallDialog from '@/components/skills/SkillInstallDialog'

export default function ClawHubSkillsTab() {
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<Skill[]>([])
    const [browseItems, setBrowseItems] = useState<ClawHubSearchItem[]>([])
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [mode, setMode] = useState<'browse' | 'search'>('browse')
    const [sortBy, setSortBy] = useState('downloads')
    const [installDialog, setInstallDialog] = useState<{ name: string; slug: string } | null>(null)

    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const observerRef = useRef<IntersectionObserver | null>(null)
    const sentinelRef = useRef<HTMLDivElement>(null)

    const handleInstall = (skillName: string, skillSlug: string) => {
        setInstallDialog({ name: skillName, slug: skillSlug })
    }

    const handleInstallSuccess = () => {
        console.log('Skill installed successfully')
    }

    const loadBrowseData = useCallback(async (cursor?: string) => {
        const isInitial = !cursor
        if (isInitial) {
            setLoading(true)
            setBrowseItems([])
        } else {
            setLoadingMore(true)
        }
        setError(null)

        try {
            const result = await clawhubApi.browse(cursor, sortBy)

            if (isInitial) {
                setBrowseItems(result.items)
            } else {
                setBrowseItems(prev => [...prev, ...result.items])
            }
            setNextCursor(result.nextCursor ?? null)
        } catch (err) {
            setError(err instanceof Error ? err.message : '加载失败')
            console.error('Browse error:', err)
        } finally {
            setLoading(false)
            setLoadingMore(false)
        }
    }, [sortBy])

    useEffect(() => {
        if (mode === 'browse') {
            loadBrowseData()
        }
    }, [mode, sortBy, loadBrowseData])

    useEffect(() => {
        if (mode !== 'browse' || !nextCursor || loadingMore) return

        const sentinel = sentinelRef.current
        if (!sentinel) return

        observerRef.current = new IntersectionObserver(
            (entries) => {
                const entry = entries[0]
                if (entry.isIntersecting && nextCursor && !loadingMore) {
                    loadBrowseData(nextCursor)
                }
            },
            {
                root: scrollContainerRef.current,
                rootMargin: '200px',
                threshold: 0.1,
            }
        )

        observerRef.current.observe(sentinel)

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect()
            }
        }
    }, [mode, nextCursor, loadingMore, loadBrowseData])

    const handleSearch = async () => {
        if (!searchQuery.trim()) return

        setLoading(true)
        setError(null)
        setMode('search')
        try {
            const results = await clawhubApi.search(searchQuery, 50)
            setSearchResults(results)
        } catch (err) {
            setError(err instanceof Error ? err.message : '搜索失败')
            console.error('Search error:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleBackToBrowse = () => {
        setMode('browse')
        setSearchQuery('')
        setSearchResults([])
        setError(null)
        loadBrowseData()
    }

    const displaySkills = mode === 'search'
        ? searchResults
        : browseItems.map(item => ({
            name: item.slug,
            description: item.summary,
            category: 'clawhub',
            source: 'clawhub' as const,
            version: undefined,
            author: item.display_name || item.name || undefined,
        }))

    return (
        <>
            <div className="flex-1 flex flex-col h-full">
                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-6xl mx-auto">
                        <div className="mb-6">
                            <h1 className="text-xl font-bold text-white mb-1">ClawHub</h1>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                浏览和安装 ClawHub 技能市场上的社区技能。
                            </p>
                        </div>

                        <div className="flex items-center gap-2 mb-5">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSearch()
                                    }}
                                    placeholder="搜索 ClawHub 技能，支持语义搜索，按 Enter 确认…"
                                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-700 bg-gray-900 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                />
                            </div>
                            <button
                                onClick={handleSearch}
                                disabled={!searchQuery.trim() || loading}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm transition-colors disabled:opacity-50"
                            >
                                <span>🔍</span>
                                搜索
                            </button>
                        </div>

                        {mode === 'search' && (
                            <div className="flex items-center justify-between mb-4">
                                <button
                                    onClick={handleBackToBrowse}
                                    className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                >
                                    ← 返回浏览
                                </button>
                                <span className="text-sm text-gray-400">
                                    找到 {searchResults.length} 个结果
                                </span>
                            </div>
                        )}

                        {mode === 'browse' && (
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-400">排序：</span>
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                        className="px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                    >
                                        <option value="downloads">下载量</option>
                                        <option value="recent">最新</option>
                                        <option value="rating">评分</option>
                                    </select>
                                </div>
                                {browseItems.length > 0 && (
                                    <span className="text-sm text-gray-400">
                                        已加载 {browseItems.length} 个技能
                                        {nextCursor && <span className="text-gray-500"> · 滚动加载更多</span>}
                                    </span>
                                )}
                            </div>
                        )}

                        {error && (
                            <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        {loading && displaySkills.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                                <p className="text-sm text-gray-400">加载中...</p>
                            </div>
                        )}

                        {displaySkills.length > 0 && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {displaySkills.map((skill, index) => (
                                        <div
                                            key={`${skill.name}-${index}`}
                                            className="p-4 rounded-lg border border-gray-700 bg-gray-800/50 hover:bg-gray-800 hover:border-gray-600 transition-all group"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <h3 className="font-medium text-white text-sm group-hover:text-blue-400 transition-colors flex-1">
                                                    {skill.name}
                                                </h3>
                                                <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 ml-2 flex-shrink-0">
                                                    ClawHub
                                                </span>
                                            </div>
                                            {skill.author && (
                                                <div className="flex items-center gap-1 mb-2">
                                                    <span className="text-xs text-gray-500">👤</span>
                                                    <span className="text-xs text-gray-400">{skill.author}</span>
                                                </div>
                                            )}
                                            {skill.description && (
                                                <p className="text-xs text-gray-400 mb-3 line-clamp-2">
                                                    {skill.description}
                                                </p>
                                            )}
                                            <button
                                                onClick={() => handleInstall(skill.name, skill.name)}
                                                className="w-full px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs transition-colors"
                                            >
                                                安装
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {mode === 'browse' && nextCursor && (
                                    <div ref={sentinelRef} className="h-20 flex items-center justify-center">
                                        {loadingMore && (
                                            <div className="flex items-center gap-2 text-gray-400">
                                                <div className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin"></div>
                                                <span className="text-sm">加载更多...</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {mode === 'browse' && !nextCursor && !loading && (
                                    <div className="flex justify-center mt-6 py-4">
                                        <span className="text-sm text-gray-500">
                                            已加载全部 {browseItems.length} 个技能
                                        </span>
                                    </div>
                                )}
                            </>
                        )}

                        {!loading && displaySkills.length === 0 && !error && (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-20 h-20 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6">
                                    <span className="text-4xl">🌐</span>
                                </div>
                                <h2 className="text-lg font-semibold text-white mb-2">
                                    {mode === 'search' ? '未找到相关技能' : 'ClawHub 技能市场'}
                                </h2>
                                <p className="text-sm text-gray-400 max-w-md leading-relaxed">
                                    {mode === 'search'
                                        ? '尝试使用不同的关键词搜索'
                                        : '浏览社区贡献的技能，或使用搜索功能查找特定技能'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {installDialog && (
                <SkillInstallDialog
                    skillName={installDialog.name}
                    skillSlug={installDialog.slug}
                    onClose={() => setInstallDialog(null)}
                    onSuccess={handleInstallSuccess}
                />
            )}
        </>
    )
}
