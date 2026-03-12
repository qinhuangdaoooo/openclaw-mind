'use client'

import { useState } from 'react'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { configApi, OpenclawConfig, ProviderModel } from '@/lib/tauri'
import { FieldGroup } from './FieldGroup'
import { TagInput } from './TagInput'

type ProviderConfig = NonNullable<OpenclawConfig['models']>['providers'][string]

interface ProviderCardProps {
    name: string
    provider: ProviderConfig
    isDefault: boolean
    onUpdate: (updates: Partial<ProviderConfig>) => void
    onRemove: () => void
    onSetDefault: () => void
}

function getModelLabel(model: ProviderModel): string {
    if (typeof model === 'string') {
        return model
    }

    return model.id || model.name || ''
}

export function ProviderCard({ name, provider, isDefault, onUpdate, onRemove, onSetDefault }: ProviderCardProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [showKey, setShowKey] = useState(false)
    const [settingDefault, setSettingDefault] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    const apiKey = provider.apiKey ?? provider.api_key ?? ''
    const baseUrl = provider.baseUrl ?? provider.base_url ?? ''
    const models = (provider.models ?? []).map(getModelLabel).filter(Boolean)

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

    const handleModelsChange = (nextLabels: string[]) => {
        const existing = new Map<string, ProviderModel>()
        for (const model of provider.models ?? []) {
            const label = getModelLabel(model)
            if (label) {
                existing.set(label, model)
            }
        }

        onUpdate({
            models: nextLabels.map((label) => existing.get(label) ?? label),
        })
    }

    return (
        <div className={`bg-gray-800 border rounded-lg overflow-hidden ${isDefault ? 'border-blue-500' : 'border-gray-700'}`}>
            <div
                className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-750"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <span className="text-lg">{isExpanded ? '▾' : '▸'}</span>
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-white">{name}</h4>
                            {isDefault && (
                                <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                                    默认
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-400">{baseUrl || provider.api}</p>
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

            {isExpanded && (
                <div className="px-4 py-3 border-t border-gray-700 space-y-3">
                    <FieldGroup label="协议 (api)" description="例如 openai-responses、anthropic-messages">
                        <input
                            type="text"
                            value={provider.api || ''}
                            onChange={(e) => onUpdate({ api: e.target.value })}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                            placeholder="openai-responses"
                        />
                    </FieldGroup>

                    <FieldGroup label="Base URL" description="模型服务的 HTTP 接口地址，对应 models.providers.<name>.baseUrl">
                        <input
                            type="text"
                            value={baseUrl}
                            onChange={(e) => onUpdate({ baseUrl: e.target.value })}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                            placeholder="https://api.example.com/v1"
                        />
                    </FieldGroup>

                    <FieldGroup label="可用模型" description="对象模型会保留原有元数据；只在你修改标签时按 id/name 匹配">
                        <TagInput
                            values={models}
                            onChange={handleModelsChange}
                            placeholder="输入模型名，按 Enter 添加"
                        />
                    </FieldGroup>

                    <FieldGroup label="API Key">
                        <div className="flex gap-2">
                            <input
                                type={showKey ? 'text' : 'password'}
                                value={apiKey}
                                onChange={(e) => onUpdate({ apiKey: e.target.value })}
                                className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                                placeholder="sk-..."
                            />
                            <button
                                onClick={() => setShowKey(!showKey)}
                                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                            >
                                {showKey ? '隐藏' : '显示'}
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
                        确定要删除提供商“{name}”吗？删除后，依赖该提供商的模型配置可能无法正常工作。
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
