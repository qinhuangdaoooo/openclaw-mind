'use client'

import { useState } from 'react'
import WorkspaceSkillsTab from './skills/WorkspaceSkillsTab'
import BuiltinSkillsTab from './skills/BuiltinSkillsTab'
import AiSkillsTab from './skills/AiSkillsTab'
import IdentitySkillsTab from './skills/IdentitySkillsTab'
import dynamic from 'next/dynamic'

// 动态导入 ClawHubSkillsTab 以避免导入问题
const ClawHubSkillsTab = dynamic(() => import('./skills/ClawHubSkillsTab'), {
    loading: () => <div className="flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div></div>,
    ssr: false
})

// Sub tabs
const SUB_TABS = [
    { id: 'workspace', label: '工作区', icon: '🧩' },
    { id: 'builtin', label: '内置', icon: '📖' },
    { id: 'clawhub', label: 'ClawHub', icon: '🌐' },
    { id: 'ai', label: 'AI 推荐', icon: '✨' },
    { id: 'identity', label: '身份配置', icon: '🤖' },
] as const

type SubTabId = typeof SUB_TABS[number]['id']

export default function SkillsTab() {
    const [activeSubTab, setActiveSubTab] = useState<SubTabId>('workspace')

    const renderSubTabContent = () => {
        switch (activeSubTab) {
            case 'workspace':
                return <WorkspaceSkillsTab />
            case 'builtin':
                return <BuiltinSkillsTab />
            case 'clawhub':
                return <ClawHubSkillsTab />
            case 'ai':
                return <AiSkillsTab />
            case 'identity':
                return <IdentitySkillsTab />
            default:
                return <WorkspaceSkillsTab />
        }
    }

    return (
        <div className="flex-1 flex flex-col h-full">
            {/* Sub Tab Navigation */}
            <nav className="flex items-center px-6 border-b border-gray-700 shrink-0 gap-6 bg-gray-800/30">
                {SUB_TABS.map((tab) => {
                    const isActive = activeSubTab === tab.id

                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id)}
                            className={`relative flex items-center gap-1.5 py-3.5 text-sm font-medium transition-colors whitespace-nowrap ${isActive ? 'text-white' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <span className={`text-base ${isActive ? '' : 'opacity-60'}`}>{tab.icon}</span>
                            {tab.label}
                            {isActive && (
                                <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-blue-500" />
                            )}
                        </button>
                    )
                })}
            </nav>

            {/* Sub Tab Content */}
            <div className="flex-1 min-w-0 overflow-hidden">
                {renderSubTabContent()}
            </div>
        </div>
    )
}
