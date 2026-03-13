'use client'

import { FieldGroup } from './FieldGroup'
import { FormSection } from './FormSection'
import { SegmentedControl } from './SegmentedControl'
import { TagInput } from './TagInput'

interface WhatsAppSectionProps {
    config: any
    setWaGroupPolicy: (policy: 'open' | 'allowlist') => void
    setWaAllowFrom: (numbers: string[]) => void
    setWaRequireMention: (required: boolean) => void
}

export function WhatsAppSection({
    config,
    setWaGroupPolicy,
    setWaAllowFrom,
    setWaRequireMention,
}: WhatsAppSectionProps) {
    return (
        <FormSection
            title="渠道 - WhatsApp"
            description="WhatsApp 消息渠道的接入白名单与群组触发规则"
        >
            <div className="space-y-3">
                <FieldGroup
                    label="群组策略 (groupPolicy)"
                    description="open：允许所有群组消息；allowlist：仅允许 allowFrom 白名单中的号码"
                >
                    <SegmentedControl
                        value={config?.channels?.whatsapp?.groupPolicy ?? 'open'}
                        options={[
                            { value: 'open', label: '开放（open）' },
                            { value: 'allowlist', label: '白名单（allowlist）' },
                        ]}
                        onChange={(v) => setWaGroupPolicy(v as 'open' | 'allowlist')}
                    />
                </FieldGroup>

                <FieldGroup
                    label="允许的号码白名单 (allowFrom)"
                    description="填写国际格式号码；仅在群组策略为「白名单」时生效"
                >
                    <TagInput
                        values={config?.channels?.whatsapp?.allowFrom ?? []}
                        onChange={setWaAllowFrom}
                        placeholder="+8613800138000，按 Enter 添加，留空允许所有来源"
                    />
                </FieldGroup>

                <div className="flex items-center justify-between py-2 px-4 rounded-lg border border-gray-700 bg-gray-800/20">
                    <div>
                        <p className="text-sm font-medium text-white">群组消息需要 @ 提及</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            groups["*"].requireMention — 群聊须 @openclaw 才触发智能体
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config?.channels?.whatsapp?.groups?.['*']?.requireMention !== false}
                            onChange={(e) => setWaRequireMention(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            </div>
        </FormSection>
    )
}
