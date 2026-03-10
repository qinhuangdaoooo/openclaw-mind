'use client'

import { useState, useEffect } from 'react'

type Theme = 'dark' | 'light' | 'system'
type Language = 'zh-CN' | 'en-US'

interface Settings {
    theme: Theme
    language: Language
    autoUpdate: boolean
    startOnBoot: boolean
    minimizeToTray: boolean
    showNotifications: boolean
}

export default function SettingsTab() {
    const [settings, setSettings] = useState<Settings>({
        theme: 'dark',
        language: 'zh-CN',
        autoUpdate: true,
        startOnBoot: false,
        minimizeToTray: true,
        showNotifications: true,
    })
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        // 从 localStorage 加载设置
        const savedSettings = localStorage.getItem('app-settings')
        if (savedSettings) {
            try {
                setSettings(JSON.parse(savedSettings))
            } catch (e) {
                console.error('加载设置失败:', e)
            }
        }
    }, [])

    const handleSave = () => {
        // 保存到 localStorage
        localStorage.setItem('app-settings', JSON.stringify(settings))

        // 应用主题
        if (settings.theme === 'light') {
            document.documentElement.classList.remove('dark')
        } else {
            document.documentElement.classList.add('dark')
        }

        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    const handleReset = () => {
        const defaultSettings: Settings = {
            theme: 'dark',
            language: 'zh-CN',
            autoUpdate: true,
            startOnBoot: false,
            minimizeToTray: true,
            showNotifications: true,
        }
        setSettings(defaultSettings)
        localStorage.setItem('app-settings', JSON.stringify(defaultSettings))
    }

    return (
        <div className="flex-1 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-white mb-1">设置</h1>
                    <p className="text-gray-400 text-sm">应用程序设置和偏好</p>
                </div>

                {/* 保存成功提示 */}
                {saved && (
                    <div className="bg-green-900/50 border border-green-700 text-green-200 px-4 py-3 rounded-lg mb-4">
                        ✅ 设置已保存
                    </div>
                )}

                {/* 外观设置 */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-4">
                    <h2 className="text-lg font-semibold text-white mb-4">🎨 外观</h2>

                    <div className="space-y-4">
                        {/* 主题选择 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                主题
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {(['dark', 'light', 'system'] as Theme[]).map((theme) => (
                                    <button
                                        key={theme}
                                        onClick={() => setSettings({ ...settings, theme })}
                                        className={`px-4 py-3 rounded-lg border-2 transition-colors ${settings.theme === theme
                                            ? 'border-blue-500 bg-blue-900/30 text-white'
                                            : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600'
                                            }`}
                                    >
                                        {theme === 'dark' && '🌙 暗色'}
                                        {theme === 'light' && '☀️ 亮色'}
                                        {theme === 'system' && '💻 跟随系统'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 语言选择 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                语言
                            </label>
                            <select
                                value={settings.language}
                                onChange={(e) => setSettings({ ...settings, language: e.target.value as Language })}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            >
                                <option value="zh-CN">🇨🇳 简体中文</option>
                                <option value="en-US">🇺🇸 English</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* 应用设置 */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-4">
                    <h2 className="text-lg font-semibold text-white mb-4">⚙️ 应用</h2>

                    <div className="space-y-4">
                        {/* 自动更新 */}
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-white font-medium">自动更新</div>
                                <div className="text-sm text-gray-400">自动检查并安装更新</div>
                            </div>
                            <button
                                onClick={() => setSettings({ ...settings, autoUpdate: !settings.autoUpdate })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.autoUpdate ? 'bg-blue-600' : 'bg-gray-700'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.autoUpdate ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>

                        {/* 开机启动 */}
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-white font-medium">开机启动</div>
                                <div className="text-sm text-gray-400">系统启动时自动运行</div>
                            </div>
                            <button
                                onClick={() => setSettings({ ...settings, startOnBoot: !settings.startOnBoot })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.startOnBoot ? 'bg-blue-600' : 'bg-gray-700'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.startOnBoot ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>

                        {/* 最小化到托盘 */}
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-white font-medium">最小化到托盘</div>
                                <div className="text-sm text-gray-400">关闭窗口时最小化到系统托盘</div>
                            </div>
                            <button
                                onClick={() => setSettings({ ...settings, minimizeToTray: !settings.minimizeToTray })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.minimizeToTray ? 'bg-blue-600' : 'bg-gray-700'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.minimizeToTray ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>

                        {/* 显示通知 */}
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-white font-medium">显示通知</div>
                                <div className="text-sm text-gray-400">显示系统通知</div>
                            </div>
                            <button
                                onClick={() => setSettings({ ...settings, showNotifications: !settings.showNotifications })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.showNotifications ? 'bg-blue-600' : 'bg-gray-700'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.showNotifications ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>
                    </div>
                </div>

                {/* 关于 */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-4">
                    <h2 className="text-lg font-semibold text-white mb-4">ℹ️ 关于</h2>

                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-400">应用名称</span>
                            <span className="text-white">OpenClaw Manager</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">版本</span>
                            <span className="text-white">0.1.0</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">技术栈</span>
                            <span className="text-white">Rust + Tauri + Next.js</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">许可证</span>
                            <span className="text-white">MIT</span>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-700">
                        <a
                            href="https://github.com/openclaw/openclaw-manager"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-sm"
                        >
                            🔗 GitHub 仓库
                        </a>
                    </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-3">
                    <button
                        onClick={handleSave}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
                    >
                        💾 保存设置
                    </button>
                    <button
                        onClick={handleReset}
                        className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors"
                    >
                        🔄 重置
                    </button>
                </div>
            </div>
        </div>
    )
}
