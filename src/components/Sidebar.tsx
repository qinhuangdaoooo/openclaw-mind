'use client'

interface SidebarProps {
    activeTab: string
    onTabChange: (tab: string) => void
}

const primaryTabs = [
    { id: 'mind', label: '团队房间', icon: '💬' },
    { id: 'tools', label: '环境配置', icon: '🧰' },
    { id: 'connect', label: '安装与连接', icon: '🔌' },
    { id: 'chat-tools', label: '聊天工具管理', icon: '🗂️' },
]

const manageTabs = [
    { id: 'skills', label: '技能管理', icon: '🧠' },
    { id: 'agents', label: 'Agent 管理', icon: '🤖' },
    { id: 'config', label: '配置文件', icon: '📝' },
    { id: 'settings', label: '设置', icon: '⚙️' },
]

function TabButton({
    id,
    label,
    icon,
    activeTab,
    onTabChange,
}: {
    id: string
    label: string
    icon: string
    activeTab: string
    onTabChange: (tab: string) => void
}) {
    const active = activeTab === id

    return (
        <button
            onClick={() => onTabChange(id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
        >
            <span className="text-xl">{icon}</span>
            <span className="font-medium">{label}</span>
        </button>
    )
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
    return (
        <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-800">
                <h2 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    OpenClaw Mind
                </h2>
                <p className="text-xs text-gray-500 mt-1">v0.1.0</p>
            </div>

            <nav className="flex-1 p-2 space-y-4 overflow-y-auto">
                <div className="space-y-1">
                    {primaryTabs.map((tab) => (
                        <TabButton
                            key={tab.id}
                            {...tab}
                            activeTab={activeTab}
                            onTabChange={onTabChange}
                        />
                    ))}
                </div>

                <div className="px-3 pt-2">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-gray-600">管理</p>
                </div>
                <div className="space-y-1">
                    {manageTabs.map((tab) => (
                        <TabButton
                            key={tab.id}
                            {...tab}
                            activeTab={activeTab}
                            onTabChange={onTabChange}
                        />
                    ))}
                </div>
            </nav>

            <div className="p-4 border-t border-gray-800">
                <div className="text-xs text-gray-500">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span>Tauri + Next.js</span>
                    </div>
                    <div className="text-gray-600">桌面控制台</div>
                </div>
            </div>
        </div>
    )
}
