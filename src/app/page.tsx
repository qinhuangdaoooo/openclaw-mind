'use client'

import { useState, useEffect } from 'react'
import TitleBar from '@/components/TitleBar'
import Sidebar from '@/components/Sidebar'
import AgentsTab from '@/components/tabs/AgentsTab'
import MindTab from '@/components/tabs/MindTab'
import SkillsTab from '@/components/tabs/SkillsTab-v2'
import ConfigTab from '@/components/tabs/ConfigTab-v2'
import ConnectTab from '@/components/tabs/ConnectTab'
import ChatToolsTab from '@/components/tabs/ChatToolsTab'
import ToolsTab from '@/components/tabs/ToolsTab'
import SettingsTab from '@/components/tabs/SettingsTab'

export default function Home() {
    const [activeTab, setActiveTab] = useState('mind')

    // 监听导航事件
    useEffect(() => {
        const handleNavigateToConfig = () => {
            setActiveTab('config')
        }

        window.addEventListener('navigate-to-config', handleNavigateToConfig)
        return () => {
            window.removeEventListener('navigate-to-config', handleNavigateToConfig)
        }
    }, [])

    const renderTab = () => {
        switch (activeTab) {
            case 'mind':
                return <MindTab />
            case 'tools':
                return <ToolsTab />
            case 'connect':
                return <ConnectTab />
            case 'chat-tools':
                return <ChatToolsTab />
            case 'skills':
                return <SkillsTab />
            case 'agents':
                return <AgentsTab />
            case 'config':
                return <ConfigTab />
            case 'settings':
                return <SettingsTab />
            default:
                return <ToolsTab />
        }
    }

    return (
        <div className="h-screen flex flex-col bg-gray-950">
            <TitleBar />
            <div className="flex-1 flex overflow-hidden">
                <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
                <main className="flex-1 overflow-y-auto">
                    {renderTab()}
                </main>
            </div>
        </div>
    )
}
