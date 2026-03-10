'use client'

import { useState } from 'react'
import { FieldGroup } from './FieldGroup'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

interface EnvVarsSectionProps {
    env: Record<string, string> | undefined
    onChange: (env: Record<string, string>) => void
}

export function EnvVarsSection({ env, onChange }: EnvVarsSectionProps) {
    const [showAdd, setShowAdd] = useState(false)
    const [newKey, setNewKey] = useState('')
    const [newValue, setNewValue] = useState('')
    const [deleteKey, setDeleteKey] = useState<string | null>(null)

    const envEntries = Object.entries(env || {})

    const addEnvVar = () => {
        if (!newKey.trim()) return
        onChange({
            ...env,
            [newKey]: newValue
        })
        setNewKey('')
        setNewValue('')
        setShowAdd(false)
    }

    const updateEnvVar = (key: string, value: string) => {
        onChange({
            ...env,
            [key]: value
        })
    }

    const removeEnvVar = (key: string) => {
        const newEnv = { ...env }
        delete newEnv[key]
        onChange(newEnv)
    }

    return (
        <div className="space-y-3">
            {showAdd && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
                    <FieldGroup label="变量名">
                        <input
                            type="text"
                            value={newKey}
                            onChange={(e) => setNewKey(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                            placeholder="例如: API_KEY"
                            autoFocus
                        />
                    </FieldGroup>
                    <FieldGroup label="变量值">
                        <input
                            type="text"
                            value={newValue}
                            onChange={(e) => setNewValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addEnvVar()}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                            placeholder="变量值"
                        />
                    </FieldGroup>
                    <div className="flex gap-2">
                        <button
                            onClick={addEnvVar}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                        >
                            添加
                        </button>
                        <button
                            onClick={() => {
                                setShowAdd(false)
                                setNewKey('')
                                setNewValue('')
                            }}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                        >
                            取消
                        </button>
                    </div>
                </div>
            )}

            {!showAdd && (
                <button
                    onClick={() => setShowAdd(true)}
                    className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 border-dashed text-gray-400 hover:text-white text-sm rounded transition-colors"
                >
                    + 添加环境变量
                </button>
            )}

            {envEntries.length === 0 ? (
                <div className="text-center py-6 text-gray-500 bg-gray-800/30 rounded-lg border border-gray-700 border-dashed">
                    <p className="text-sm">暂无环境变量</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {envEntries.map(([key, value]) => (
                        <div
                            key={key}
                            className="bg-gray-800 border border-gray-700 rounded-lg p-3 flex items-center gap-3"
                        >
                            <div className="flex-1 grid grid-cols-2 gap-3">
                                <div>
                                    <div className="text-xs text-gray-400 mb-1">变量名</div>
                                    <div className="text-sm text-white font-mono">{key}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-400 mb-1">变量值</div>
                                    <input
                                        type="text"
                                        value={value}
                                        onChange={(e) => updateEnvVar(key, e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setDeleteKey(key)
                                }}
                                className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                            >
                                删除
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmDialog
                open={deleteKey !== null}
                title="删除环境变量"
                description={
                    deleteKey && (
                        <p className="text-xs leading-relaxed">
                            确定要删除环境变量「{deleteKey}」吗？删除后依赖该变量的功能可能无法正常工作。
                        </p>
                    )
                }
                confirmLabel="删除"
                cancelLabel="取消"
                danger
                onCancel={() => setDeleteKey(null)}
                onConfirm={() => {
                    if (deleteKey) {
                        removeEnvVar(deleteKey)
                    }
                    setDeleteKey(null)
                }}
            />
        </div>
    )
}
