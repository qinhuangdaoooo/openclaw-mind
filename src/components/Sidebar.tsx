'use client'

interface SidebarProps {
    activeTab: string
    onTabChange: (tab: string) => void
}

const tabs = [
    { id: 'mind', label: '团队房间', icon: '💬' },
    { id: 'tools', label: '环境配置', icon: '🔧' },
    { id: 'connect', label: '安装与连接', icon: '🔗' },
    { id: 'skills', label: '技能管理', icon: '⚡' },
    { id: 'agents', label: 'Agent 管理', icon: '🤖' },
    { id: 'config', label: '配置文件', icon: '⚙️' },
    { id: 'settings', label: '设置', icon: '🔨' },
]

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
    return (
        <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-800">
                <h2 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                    OpenClaw Mind
                </h2>
                <p className="text-xs text-gray-500 mt-1">v0.1.0</p>
            </div>

            <nav className="flex-1 p-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${activeTab === tab.id
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                            }`}
                    >
                        <span className="text-xl">{tab.icon}</span>
                        <span className="font-medium">{tab.label}</span>
                    </button>
                ))}
            </nav>

            <div className="p-4 border-t border-gray-800">
                <div className="text-xs text-gray-500">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Tauri + Next.js</span>
                    </div>
                    <div className="text-gray-600">Phase 3 开发中</div>
                </div>
            </div>
        </div>
    )
}
