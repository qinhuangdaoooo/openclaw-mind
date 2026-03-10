'use client'

import { useState, useEffect } from 'react'
import { configApi, OpenclawConfig, ValidationResult } from '@/lib/tauri'

export default function ConfigTab() {
    const [config, setConfig] = useState<OpenclawConfig | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [editMode, setEditMode] = useState(false)
    const [configJson, setConfigJson] = useState('')
    const [validation, setValidation] = useState<ValidationResult | null>(null)
    const [validating, setValidating] = useState(false)

    useEffect(() => {
        loadConfig()
    }, [])

    // 实时验证
    useEffect(() => {
        if (editMode && configJson) {
            const timer = setTimeout(() => {
                validateConfig()
            }, 500) // 防抖 500ms
            return () => clearTimeout(timer)
        }
    }, [configJson, editMode])

    const loadConfig = async () => {
        setLoading(true)
        setError(null)
        try {
            const cfg = await configApi.read()
            setConfig(cfg)
            setConfigJson(JSON.stringify(cfg, null, 2))
        } catch (err) {
            setError(String(err))
        } finally {
            setLoading(false)
        }
    }

    const validateConfig = async () => {
        if (!configJson.trim()) {
            setValidation(null)
            return
        }

        setValidating(true)
        try {
            const result = await configApi.validate(configJson)
            setValidation(result)
        } catch (err) {
            setValidation({
                valid: false,
                errors: [{ field: 'JSON', message: String(err) }]
            })
        } finally {
            setValidating(false)
        }
    }

    const handleSave = async () => {
        // 保存前再次验证
        await validateConfig()

        if (validation && !validation.valid) {
            setError('配置验证失败，请修复错误后再保存')
            return
        }

        setLoading(true)
        setError(null)
        setSuccess(null)
        try {
            const newConfig = JSON.parse(configJson)
            await configApi.write(newConfig)
            setConfig(newConfig)
            setEditMode(false)
            setValidation(null)
            setSuccess('配置保存成功！')
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            setError(String(err))
        } finally {
            setLoading(false)
        }
    }

    const handleReloadGateway = async () => {
        setLoading(true)
        setError(null)
        setSuccess(null)
        try {
            const result = await configApi.reloadGateway()
            setSuccess(`Gateway 重载成功: ${result}`)
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            setError(String(err))
        } finally {
            setLoading(false)
        }
    }

    const handleCancel = () => {
        setEditMode(false)
        setConfigJson(JSON.stringify(config, null, 2))
        setValidation(null)
        setError(null)
    }

    return (
        <div className="flex-1 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">Configuration</h1>
                        <p className="text-gray-400 text-sm">管理 OpenClaw 配置</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleReloadGateway}
                            disabled={loading}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                            🔄 重载 Gateway
                        </button>
                        {editMode ? (
                            <>
                                <button
                                    onClick={handleSave}
                                    disabled={loading || (validation !== null && !validation.valid)}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                                >
                                    💾 保存
                                </button>
                                <button
                                    onClick={handleCancel}
                                    disabled={loading}
                                    className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white px-4 py-2 rounded-lg transition-colors"
                                >
                                    取消
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setEditMode(true)}
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                            >
                                ✏️ 编辑
                            </button>
                        )}
                    </div>
                </div>

                {/* Messages */}
                {error && (
                    <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="bg-green-900/50 border border-green-700 text-green-200 px-4 py-3 rounded-lg mb-4">
                        {success}
                    </div>
                )}

                {/* Validation Status */}
                {editMode && validation && (
                    <div className={`border rounded-lg px-4 py-3 mb-4 ${validation.valid
                        ? 'bg-green-900/30 border-green-700 text-green-200'
                        : 'bg-yellow-900/30 border-yellow-700 text-yellow-200'
                        }`}>
                        <div className="flex items-start gap-2">
                            <span className="text-xl">{validation.valid ? '✓' : '⚠️'}</span>
                            <div className="flex-1">
                                {validation.valid ? (
                                    <p className="font-semibold">配置验证通过</p>
                                ) : (
                                    <>
                                        <p className="font-semibold mb-2">发现 {validation.errors.length} 个问题：</p>
                                        <ul className="space-y-1 text-sm">
                                            {validation.errors.map((err, index) => (
                                                <li key={index} className="flex items-start gap-2">
                                                    <span className="text-yellow-400">•</span>
                                                    <span>
                                                        <span className="font-mono text-yellow-300">{err.field}</span>: {err.message}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                            </div>
                            {validating && (
                                <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                            )}
                        </div>
                    </div>
                )}

                {/* Config Display */}
                {loading && !config ? (
                    <div className="text-center py-12 text-gray-500">
                        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p>加载配置中...</p>
                    </div>
                ) : config ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Config Editor */}
                        <div className="lg:col-span-2">
                            <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                                <div className="bg-gray-900 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
                                    <span className="text-sm text-gray-400 font-mono">openclaw.json</span>
                                    {editMode && (
                                        <span className="text-xs text-gray-500">
                                            {configJson.split('\n').length} 行
                                        </span>
                                    )}
                                </div>
                                {editMode ? (
                                    <textarea
                                        value={configJson}
                                        onChange={(e) => setConfigJson(e.target.value)}
                                        className="w-full h-[600px] bg-gray-900 text-white font-mono text-sm p-4 focus:outline-none resize-none"
                                        spellCheck={false}
                                    />
                                ) : (
                                    <pre className="p-4 text-sm text-gray-300 overflow-auto h-[600px]">
                                        {configJson}
                                    </pre>
                                )}
                            </div>
                        </div>

                        {/* Config Info */}
                        <div className="space-y-4">
                            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                                <h3 className="text-white font-semibold mb-3">配置信息</h3>
                                <div className="space-y-3">
                                    <div>
                                        <div className="text-gray-400 text-xs mb-1">Gateway 模式</div>
                                        <div className="text-white text-sm font-mono">
                                            {config.gateway?.mode || '未设置'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-gray-400 text-xs mb-1">Gateway 端口</div>
                                        <div className="text-white text-sm font-mono">
                                            {config.gateway?.port || '未设置'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-gray-400 text-xs mb-1">Providers</div>
                                        <div className="text-white text-sm font-mono">
                                            {config.models?.providers ? Object.keys(config.models.providers).length : 0}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-gray-400 text-xs mb-1">Agents</div>
                                        <div className="text-white text-sm font-mono">
                                            {config.agents?.list?.length || 0}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Validation Tips */}
                            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                                <div className="flex items-start gap-2">
                                    <span className="text-xl">💡</span>
                                    <div className="flex-1 text-sm text-blue-200">
                                        <p className="font-semibold mb-2">验证规则</p>
                                        <ul className="space-y-1 text-xs text-blue-300">
                                            <li>• JSON 格式必须正确</li>
                                            <li>• Gateway 端口范围 1-65535</li>
                                            <li>• Provider API 必须以 http:// 或 https:// 开头</li>
                                            <li>• Agent ID 不能为空</li>
                                            <li>• 编辑时自动验证（500ms 防抖）</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* File Path */}
                            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                                <div className="text-gray-400 text-xs mb-1">配置文件路径</div>
                                <div className="text-gray-300 text-xs font-mono break-all">
                                    ~/.openclaw/openclaw.json
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 text-gray-500">
                        <p className="text-4xl mb-4">⚙️</p>
                        <p>配置文件不存在</p>
                        <p className="text-sm mt-2">~/.openclaw/openclaw.json</p>
                    </div>
                )}
            </div>
        </div>
    )
}
