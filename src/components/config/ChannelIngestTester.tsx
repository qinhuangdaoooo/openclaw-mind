'use client'

import { useEffect, useState } from 'react'
import { ChannelIngestResult, OpenclawConfig, configApi } from '@/lib/tauri'
import { FieldGroup } from './FieldGroup'
import { SegmentedControl } from './SegmentedControl'

type PeerKind = 'private' | 'group' | 'channel'

interface ChannelIngestTesterProps {
    config: OpenclawConfig | null
    channel: 'feishu' | 'qqbridge'
    heading: string
    description: string
    peerIdLabel: string
    peerIdPlaceholder: string
    senderIdPlaceholder: string
    defaultPeerKind?: PeerKind
    defaultPeerId?: string
}

const PEER_KIND_OPTIONS: { value: PeerKind; label: string }[] = [
    { value: 'private', label: '私聊' },
    { value: 'group', label: '群聊' },
    { value: 'channel', label: '频道' },
]

export function ChannelIngestTester({
    config,
    channel,
    heading,
    description,
    peerIdLabel,
    peerIdPlaceholder,
    senderIdPlaceholder,
    defaultPeerKind = 'group',
    defaultPeerId,
}: ChannelIngestTesterProps) {
    const [peerKind, setPeerKind] = useState<PeerKind>(defaultPeerKind)
    const [peerId, setPeerId] = useState(defaultPeerId ?? '')
    const [sessionTitle, setSessionTitle] = useState('')
    const [senderId, setSenderId] = useState('')
    const [content, setContent] = useState('')
    const [ingesting, setIngesting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<ChannelIngestResult | null>(null)

    useEffect(() => {
        if (!peerId.trim() && defaultPeerId?.trim()) {
            setPeerId(defaultPeerId)
        }
    }, [defaultPeerId, peerId])

    const canSubmit =
        !!config &&
        !ingesting &&
        peerId.trim().length > 0 &&
        senderId.trim().length > 0 &&
        content.trim().length > 0

    const handleIngest = async () => {
        if (!config || !canSubmit) {
            return
        }

        setIngesting(true)
        setError(null)
        setResult(null)

        try {
            const ingestResult = await configApi.ingestChannelMessage(
                config,
                channel,
                peerKind,
                peerId.trim(),
                sessionTitle.trim() || undefined,
                senderId.trim(),
                content.trim()
            )

            setResult(ingestResult)
        } catch (err) {
            setError(String(err))
        } finally {
            setIngesting(false)
        }
    }

    const openMindTab = () => {
        window.dispatchEvent(new CustomEvent('navigate-to-mind'))
    }

    return (
        <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-semibold text-sky-300">{heading}</h3>
                    <p className="text-xs text-gray-400 mt-1">{description}</p>
                    <p className="text-[11px] text-gray-500 mt-2">
                        会直接使用当前编辑中的 `bindings` 规则导入到 Mind，不需要先保存配置。
                    </p>
                </div>
                <button
                    onClick={handleIngest}
                    disabled={!canSubmit}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:bg-gray-700 text-white text-xs font-medium transition-colors"
                >
                    {ingesting ? '导入中...' : '测试导入 Mind'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FieldGroup label="会话类型">
                    <SegmentedControl
                        value={peerKind}
                        options={PEER_KIND_OPTIONS}
                        onChange={(nextValue) => setPeerKind(nextValue as PeerKind)}
                        compact
                    />
                </FieldGroup>

                <FieldGroup label={peerIdLabel}>
                    <input
                        type="text"
                        value={peerId}
                        onChange={(event) => setPeerId(event.target.value)}
                        placeholder={peerIdPlaceholder}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-sky-500"
                    />
                </FieldGroup>

                <FieldGroup label="会话标题（可选）" hint="留空时会自动生成，例如 [feishu] chat_xxx">
                    <input
                        type="text"
                        value={sessionTitle}
                        onChange={(event) => setSessionTitle(event.target.value)}
                        placeholder="产品群 / 客户对话"
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                    />
                </FieldGroup>

                <FieldGroup label="发送者 ID">
                    <input
                        type="text"
                        value={senderId}
                        onChange={(event) => setSenderId(event.target.value)}
                        placeholder={senderIdPlaceholder}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-sky-500"
                    />
                </FieldGroup>
            </div>

            <FieldGroup label="消息内容">
                <textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="输入一条测试消息，验证是否能按 bindings 命中目标 Agent 并写入 Mind"
                    rows={4}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm resize-y focus:outline-none focus:border-sky-500"
                />
            </FieldGroup>

            {error && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3">
                    <p className="text-sm font-medium text-rose-300">导入失败</p>
                    <p className="text-xs text-rose-200/90 mt-1 break-all">{error}</p>
                </div>
            )}

            {result && (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 space-y-2">
                    <p className="text-sm font-medium text-emerald-300">测试消息已写入 Mind</p>
                    <div className="text-xs text-gray-300 space-y-1">
                        <p>
                            会话：<span className="font-medium text-white">{result.room.title}</span>
                        </p>
                        <p>
                            房间 ID：<span className="font-mono text-white">{result.room.id}</span>
                        </p>
                        <p>
                            消息 ID：<span className="font-mono text-white">{result.message.id}</span>
                        </p>
                        <p>
                            路由结果：
                            <span className="text-white">
                                {result.matched_agent_id
                                    ? ` 已命中 Agent ${result.matched_agent_id}`
                                    : ' 未命中任何 binding，已作为普通外部消息写入'}
                            </span>
                        </p>
                    </div>
                    <button
                        onClick={openMindTab}
                        className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium transition-colors"
                    >
                        打开 Mind 查看
                    </button>
                </div>
            )}
        </div>
    )
}
