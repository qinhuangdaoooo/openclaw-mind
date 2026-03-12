'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import TitleBar from '@/components/TitleBar'
import AgentsTab from '@/components/tabs/AgentsTab'
import ChatToolsTab from '@/components/tabs/ChatToolsTab'
import ConfigTab from '@/components/tabs/ConfigTab-v2'
import ConnectTab from '@/components/tabs/ConnectTab'
import MindTab from '@/components/tabs/MindTab'
import SettingsTab from '@/components/tabs/SettingsTab'
import SkillsTab from '@/components/tabs/SkillsTab-v2'
import ToolsTab from '@/components/tabs/ToolsTab'

export default function Home() {
    const [activeTab, setActiveTab] = useState('mind')

    useEffect(() => {
        const handleNavigateToConfig = () => {
            setActiveTab('config')
        }

        const handleNavigateToMind = () => {
            setActiveTab('mind')
        }

        window.addEventListener('navigate-to-config', handleNavigateToConfig)
        window.addEventListener('navigate-to-mind', handleNavigateToMind)

        return () => {
            window.removeEventListener('navigate-to-config', handleNavigateToConfig)
            window.removeEventListener('navigate-to-mind', handleNavigateToMind)
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
                return <MindTab />
        }
    }

    return (
        <div className="h-screen flex flex-col bg-gray-950">
            <TitleBar />
            <div className="flex-1 flex overflow-hidden">
                <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
                <main className="flex-1 overflow-y-auto">{renderTab()}</main>
            </div>
        </div>
    )
}
