'use client'

import type { ChannelTestResult, OpenclawConfig } from '@/lib/tauri'
import { FieldGroup } from './FieldGroup'
import { FormSection } from './FormSection'
import { SegmentedControl } from './SegmentedControl'
import { TagInput } from './TagInput'

type FeishuValue = NonNullable<NonNullable<OpenclawConfig['channels']>['feishu']>

interface FeishuSectionProps {
    value: FeishuValue | undefined
    onChange: (updates: Partial<FeishuValue>) => void
    onTest: () => void
    testing?: boolean
    testResult?: ChannelTestResult | null
}

export function FeishuSection({ value, onChange, onTest, testing, testResult }: FeishuSectionProps) {
    return (
        <FormSection
            title="渠道 - Feishu"
            description="配置飞书机器人 / Webhook 接入参数，后续可通过 bindings 将消息路由到指定 Agent"
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
                        <p className="text-sm font-medium text-white">启用飞书接入</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            开启后建议同时填写 App ID、App Secret 和默认会话信息
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FieldGroup label="App ID" hint="对应 channels.feishu.appId">
                        <input
                            type="text"
                            value={value?.appId ?? ''}
                            onChange={(event) => onChange({ appId: event.target.value })}
                            placeholder="cli_xxx"
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                        />
                    </FieldGroup>

                    <FieldGroup label="App Secret" hint="对应 channels.feishu.appSecret">
                        <input
                            type="password"
                            value={value?.appSecret ?? ''}
                            onChange={(event) => onChange({ appSecret: event.target.value })}
                            placeholder="secret"
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                        />
                    </FieldGroup>

                    <FieldGroup label="Verification Token">
                        <input
                            type="text"
                            value={value?.verificationToken ?? ''}
                            onChange={(event) => onChange({ verificationToken: event.target.value })}
                            placeholder="verification-token"
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                        />
                    </FieldGroup>

                    <FieldGroup label="Encrypt Key">
                        <input
                            type="text"
                            value={value?.encryptKey ?? ''}
                            onChange={(event) => onChange({ encryptKey: event.target.value })}
                            placeholder="encrypt-key"
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                        />
                    </FieldGroup>
                </div>

                <FieldGroup label="默认会话 ID" hint="未命中更精细 bindings 时，可作为默认聊天目标">
                    <input
                        type="text"
                        value={value?.defaultChatId ?? ''}
                        onChange={(event) => onChange({ defaultChatId: event.target.value })}
                        placeholder="oc_xxx / chat_id"
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                    />
                </FieldGroup>

                <FieldGroup
                    label="群聊策略 (groupPolicy)"
                    hint="open 表示允许所有会话；allowlist 表示仅允许 allowChats 中列出的会话"
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

                <FieldGroup label="允许的会话 (allowChats)">
                    <TagInput
                        values={value?.allowChats ?? []}
                        onChange={(values) => onChange({ allowChats: values })}
                        placeholder="chat_id，按 Enter 添加"
                    />
                </FieldGroup>

                <div className="flex items-center justify-between py-2 px-4 rounded-lg border border-gray-700 bg-gray-800/20">
                    <div>
                        <p className="text-sm font-medium text-white">群聊消息需 @ 才触发</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            适合把飞书群消息收窄到明确提及时再路由给 Agent
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
