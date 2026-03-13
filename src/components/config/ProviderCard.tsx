'use client'

import { useMemo, useState } from 'react'
import { FieldGroup } from './FieldGroup'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { TagInput } from './TagInput'
import {
    buildProviderPrimary,
    configApi,
    getProviderApiKey,
    getProviderBaseUrl,
    getProviderModelId,
    getProviderModelLabel,
    type ProviderConfig,
} from '@/lib/tauri'

interface ProviderCardProps {
    name: string
    provider: ProviderConfig
    isDefault: boolean
    onUpdate: (updates: Partial<ProviderConfig>) => void
    onRemove: () => void
    onSetDefault: (primary: string) => void
}

export function ProviderCard({ name, provider, isDefault, onUpdate, onRemove, onSetDefault }: ProviderCardProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [showKey, setShowKey] = useState(false)
    const [settingDefault, setSettingDefault] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    const modelTags = useMemo(
        () => (provider.models ?? []).map((model) => getProviderModelLabel(model)).filter(Boolean),
        [provider.models]
    )

    const syncModelEntries = (labels: string[]) => {
        const nextModels = labels
            .map((label, index) => {
                const trimmed = label.trim()
                if (!trimmed) return null

                const previous = provider.models?.[index]
                if (previous && typeof previous !== 'string') {
                    return {
                        ...previous,
                        id: trimmed,
                        name: trimmed,
                    }
                }

                return trimmed
            })
            .filter(Boolean)

        onUpdate({ models: nextModels as ProviderConfig['models'] })
    }

    const handleSetDefault = async (e: React.MouseEvent) => {
        e.stopPropagation()
        setSettingDefault(true)
        try {
            await configApi.setDefaultProvider(name)
            onSetDefault(buildProviderPrimary(name, provider))
        } catch (err) {
            console.error('Failed to set default provider:', err)
            alert(`设置默认提供商失败: ${err}`)
        } finally {
            setSettingDefault(false)
        }
    }

    const baseUrl = getProviderBaseUrl(provider) || ''
    const apiKey = getProviderApiKey(provider) || ''
    const firstModelId = provider.models?.map((item) => getProviderModelId(item)).find(Boolean)

    return (
        <div className={`bg-gray-800 border rounded-lg overflow-hidden ${isDefault ? 'border-blue-500' : 'border-gray-700'}`}>
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
                        <p className="text-xs text-gray-400">{baseUrl || provider.api || '未配置地址'}</p>
                        {firstModelId && (
                            <p className="text-[11px] text-gray-500 mt-0.5">首选模型：{firstModelId}</p>
                        )}
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
                    <FieldGroup label="Base URL" description="模型服务的基础地址，对应 baseUrl / base_url">
                        <input
                            type="text"
                            value={baseUrl}
                            onChange={(e) => onUpdate({ baseUrl: e.target.value, base_url: e.target.value })}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                            placeholder="https://api.openai.com/v1"
                        />
                    </FieldGroup>

                    <FieldGroup label="API 协议" description="例如 openai-responses、anthropic-messages">
                        <input
                            type="text"
                            value={provider.api || ''}
                            onChange={(e) => onUpdate({ api: e.target.value })}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                            placeholder="openai-responses"
                        />
                    </FieldGroup>

                    <FieldGroup label="可用模型" description="支持字符串模型名，也兼容对象模型，编辑时会保留原有对象结构">
                        <TagInput
                            values={modelTags}
                            onChange={syncModelEntries}
                            placeholder="输入模型名称，按 Enter 添加"
                        />
                    </FieldGroup>

                    <FieldGroup label="API Key">
                        <div className="flex gap-2">
                            <input
                                type={showKey ? 'text' : 'password'}
                                value={apiKey}
                                onChange={(e) => onUpdate({ apiKey: e.target.value, api_key: e.target.value })}
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
