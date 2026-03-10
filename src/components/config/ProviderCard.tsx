'use client'

import { useState } from 'react'
import { FieldGroup } from './FieldGroup'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { TagInput } from './TagInput'
import { configApi } from '@/lib/tauri'

interface ProviderConfig {
    api: string
    api_key?: string
    base_url?: string
    models?: string[]
}

interface ProviderCardProps {
    name: string
    provider: ProviderConfig
    isDefault: boolean
    onUpdate: (updates: Partial<ProviderConfig>) => void
    onRemove: () => void
    onSetDefault: () => void
}

export function ProviderCard({ name, provider, isDefault, onUpdate, onRemove, onSetDefault }: ProviderCardProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [showKey, setShowKey] = useState(false)
    const [settingDefault, setSettingDefault] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    const handleSetDefault = async (e: React.MouseEvent) => {
        e.stopPropagation()
        setSettingDefault(true)
        try {
            await configApi.setDefaultProvider(name)
            onSetDefault()
        } catch (err) {
            console.error('Failed to set default provider:', err)
            alert(`设置默认提供商失败: ${err}`)
        } finally {
            setSettingDefault(false)
        }
    }

    return (
        <div className={`bg-gray-800 border rounded-lg overflow-hidden ${isDefault ? 'border-blue-500' : 'border-gray-700'}`}>
            {/* Header */}
            <div
                className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-750"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <span className="text-lg">
                        {isExpanded ? '▼' : '▶'}
                    </span>
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-white">{name}</h4>
                            {isDefault && (
                                <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                                    默认
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-400">{provider.api}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!isDefault && (
                        <button
                            onClick={handleSetDefault}
                            disabled={settingDefault}
                            className="px-3 py-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded transition-colors disabled:opacity-50"
                        >
                            {settingDefault ? '设置中...' : '设为默认'}
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            setShowDeleteConfirm(true)
                        }}
                        className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                    >
                        删除
                    </button>
                </div>
            </div>

            {/* Body */}
            {isExpanded && (
                <div className="px-4 py-3 border-t border-gray-700 space-y-3">
                    <FieldGroup label="API 地址" description="模型服务的 HTTP 接口地址，对应配置中的 models.providers.&lt;name&gt;.api">
                        <input
                            type="text"
                            value={provider.api || ''}
                            onChange={(e) => {
                                const url = e.target.value
                                onUpdate({ api: url, base_url: url })
                            }}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                            placeholder="https://api.openai.com/v1"
                        />
                    </FieldGroup>

                    <FieldGroup label="可用模型" description="为该提供商配置可选模型列表，例如 gpt-4o, gpt-4o-mini">
                        <TagInput
                            values={provider.models ?? []}
                            onChange={(models) => onUpdate({ models })}
                            placeholder="输入模型名称，按 Enter 添加"
                        />
                    </FieldGroup>

                    <FieldGroup label="API Key">
                        <div className="flex gap-2">
                            <input
                                type={showKey ? 'text' : 'password'}
                                value={provider.api_key || ''}
                                onChange={(e) => onUpdate({ api_key: e.target.value })}
                                className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                                placeholder="sk-..."
                            />
                            <button
                                onClick={() => setShowKey(!showKey)}
                                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                            >
                                {showKey ? '👁️' : '👁️‍🗨️'}
                            </button>
                        </div>
                    </FieldGroup>
                </div>
            )}

            <ConfirmDialog
                open={showDeleteConfirm}
                title="删除模型提供商"
                description={
                    <p className="text-xs leading-relaxed">
                        确定要删除提供商「{name}」吗？删除后，依赖该提供商的模型配置可能无法正常工作。
                    </p>
                }
                confirmLabel="删除"
                cancelLabel="取消"
                danger
                onCancel={() => setShowDeleteConfirm(false)}
                onConfirm={() => {
                    setShowDeleteConfirm(false)
                    onRemove()
                }}
            />
        </div>
    )
}
