'use client'

import type { ChannelTestResult, OpenclawConfig } from '@/lib/tauri'
import { FieldGroup } from './FieldGroup'
import { FormSection } from './FormSection'
import { SegmentedControl } from './SegmentedControl'
import { TagInput } from './TagInput'

type QqBridgeValue = NonNullable<NonNullable<OpenclawConfig['channels']>['qqBridge']>

interface QqBridgeSectionProps {
    value: QqBridgeValue | undefined
    onChange: (updates: Partial<QqBridgeValue>) => void
    onTest: () => void
    testing?: boolean
    testResult?: ChannelTestResult | null
}

export function QqBridgeSection({ value, onChange, onTest, testing, testResult }: QqBridgeSectionProps) {
    return (
        <FormSection
            title="渠道 - 请求桥接"
            description="配置请求桥接服务（当前配置字段仍为 channels.qqBridge），并将消息交给 bindings 规则路由"
            action={
                <button
                    onClick={onTest}
                    disabled={testing}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-xs font-medium transition-colors"
                >
                    {testing ? '测试中...' : '测试连接'}
                </button>
            }
        >
            <div className="space-y-4">
                <div className="flex items-center justify-between py-0.5">
                    <div>
                        <p className="text-sm font-medium text-white">启用请求桥接</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            适合对接 OneBot、NapCat、go-cqhttp 等 HTTP / WebSocket 桥接层
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={value?.enabled === true}
                            onChange={(event) => onChange({ enabled: event.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                <FieldGroup label="桥接模式 (mode)" hint="http 适合反向 HTTP；ws 适合 WebSocket 推送">
                    <SegmentedControl
                        value={value?.mode ?? 'http'}
                        options={[
                            { value: 'http', label: 'HTTP' },
                            { value: 'ws', label: 'WebSocket' },
                        ]}
                        onChange={(nextValue) => onChange({ mode: nextValue as 'http' | 'ws' })}
                    />
                </FieldGroup>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FieldGroup label="Endpoint" hint="HTTP 示例: http://127.0.0.1:3000/callback；WS 示例: ws://127.0.0.1:6700/ws">
                        <input
                            type="text"
                            value={value?.endpoint ?? ''}
                            onChange={(event) => onChange({ endpoint: event.target.value })}
                            placeholder="http://127.0.0.1:3000/callback"
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                        />
                    </FieldGroup>

                    <FieldGroup label="Access Token">
                        <input
                            type="password"
                            value={value?.accessToken ?? ''}
                            onChange={(event) => onChange({ accessToken: event.target.value })}
                            placeholder="optional"
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                        />
                    </FieldGroup>

                    <FieldGroup label="Self ID" hint="桥接机器人自身 QQ 号，可选">
                        <input
                            type="text"
                            value={value?.selfId ?? ''}
                            onChange={(event) => onChange({ selfId: event.target.value })}
                            placeholder="123456789"
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                        />
                    </FieldGroup>
                </div>

                <FieldGroup
                    label="群聊策略 (groupPolicy)"
                    hint="open 表示允许所有群；allowlist 表示仅允许 allowGroups 中列出的群"
                >
                    <SegmentedControl
                        value={value?.groupPolicy ?? 'open'}
                        options={[
                            { value: 'open', label: 'Open' },
                            { value: 'allowlist', label: 'Allowlist' },
                        ]}
                        onChange={(nextValue) => onChange({ groupPolicy: nextValue as 'open' | 'allowlist' })}
                    />
                </FieldGroup>

                <FieldGroup label="允许的群 (allowGroups)">
                    <TagInput
                        values={value?.allowGroups ?? []}
                        onChange={(values) => onChange({ allowGroups: values })}
                        placeholder="group_id，按 Enter 添加"
                    />
                </FieldGroup>

                <div className="flex items-center justify-between py-2 px-4 rounded-lg border border-gray-700 bg-gray-800/20">
                    <div>
                        <p className="text-sm font-medium text-white">群消息需 @ 才触发</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            适合减少 QQ 群内普通消息对 Agent 的打扰
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={value?.requireMention !== false}
                            onChange={(event) => onChange({ requireMention: event.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                {testResult && (
                    <div className={`rounded-lg border px-4 py-3 ${testResult.success ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10'}`}>
                        <p className={`text-sm font-medium ${testResult.success ? 'text-emerald-300' : 'text-amber-300'}`}>
                            {testResult.message}
                        </p>
                        {testResult.details && (
                            <p className="text-xs text-gray-400 mt-1">{testResult.details}</p>
                        )}
                    </div>
                )}
            </div>
        </FormSection>
    )
}
