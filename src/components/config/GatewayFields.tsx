'use client'

import { FieldGroup } from './FieldGroup'

interface GatewayConfig {
    mode: string
    port: number
    auth?: {
        mode: string
        token?: string
        password?: string
    }
}

interface GatewayFieldsProps {
    gateway: GatewayConfig | undefined
    onChange: (gateway: GatewayConfig) => void
}

export function GatewayFields({ gateway, onChange }: GatewayFieldsProps) {
    const gw = gateway || { mode: 'http', port: 18789, auth: { mode: 'none' } }

    const updateGateway = (updates: Partial<GatewayConfig>) => {
        onChange({ ...gw, ...updates })
    }

    const updateAuth = (authUpdates: Partial<NonNullable<GatewayConfig['auth']>>) => {
        const currentAuth = gw.auth || { mode: 'none' }
        onChange({
            ...gw,
            auth: { ...currentAuth, ...authUpdates }
        })
    }

    return (
        <div className="space-y-4 bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <FieldGroup label="端口" description="Gateway 服务监听端口">
                <input
                    type="number"
                    value={gw.port || 18789}
                    onChange={(e) => updateGateway({ port: parseInt(e.target.value) || 18789 })}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="18789"
                />
            </FieldGroup>

            <FieldGroup label="认证模式">
                <select
                    value={gw.auth?.mode || 'none'}
                    onChange={(e) => updateAuth({ mode: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                    <option value="none">无认证</option>
                    <option value="token">Token 认证</option>
                    <option value="password">密码认证</option>
                </select>
            </FieldGroup>

            {gw.auth?.mode === 'token' && (
                <FieldGroup label="Token" description="用于 API 访问的令牌">
                    <input
                        type="text"
                        value={gw.auth?.token || ''}
                        onChange={(e) => updateAuth({ token: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                        placeholder="your-secret-token"
                    />
                </FieldGroup>
            )}

            {gw.auth?.mode === 'password' && (
                <FieldGroup label="密码" description="用于 Dashboard 访问的密码">
                    <input
                        type="password"
                        value={gw.auth?.password || ''}
                        onChange={(e) => updateAuth({ password: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                        placeholder="••••••••"
                    />
                </FieldGroup>
            )}
        </div>
    )
}
