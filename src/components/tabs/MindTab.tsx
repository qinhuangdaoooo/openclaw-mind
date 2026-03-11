'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
    mindApi,
    agentApi,
    Room,
    Message,
    MindTask,
    Agent,
} from '@/lib/tauri'

function formatTime(ts: number): string {
    const d = new Date(ts * 1000)
    return d.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    })
}

function getMemberDisplayName(
    senderType: string,
    senderId: string,
    agents: Agent[]
): string {
    if (senderType === 'human') return '我'
    if (senderType === 'system') return '系统'
    const a = agents.find((x) => x.id === senderId)
    if (a) return a.name?.trim() || a.id
    return senderId
}

function getAvatarLetter(senderType: string, senderId: string, agents: Agent[]): string {
    if (senderType === 'human') return '我'
    if (senderType === 'system') return '系'
    const a = agents.find((x) => x.id === senderId)
    const name = a ? (a.name?.trim() || a.id) : senderId
    return name.charAt(0).toUpperCase() || '?'
}

function avatarBgColor(id: string): string {
    if (id === 'me') return 'rgb(59, 130, 246)' // blue-500
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h << 5) - h + id.charCodeAt(i)
    const hue = Math.abs(h) % 360
    return `hsl(${hue}, 52%, 42%)`
}

function extractLastMentionAgentId(
    text: string,
    agents: Agent[]
): string | null {
    const lastAt = text.lastIndexOf('@')
    if (lastAt === -1) return null
    const afterAt = text.slice(lastAt + 1).trim()
    if (!afterAt) return null
    let best: { id: string; len: number } | null = null
    for (const x of agents) {
        const displayName = x.name?.trim() || x.id
        if (
            afterAt === displayName ||
            afterAt.startsWith(displayName + ' ') ||
            afterAt.startsWith(displayName + '\n')
        ) {
            if (!best || displayName.length > best.len)
                best = { id: x.id, len: displayName.length }
        }
    }
    return best?.id ?? null
}

export default function MindTab() {
    const [rooms, setRooms] = useState<Room[]>([])
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [tasks, setTasks] = useState<MindTask[]>([])
    const [agents, setAgents] = useState<Agent[]>([])
    const [selectedAgentId, setSelectedAgentId] = useState<string>('')
    const [newRoomTitle, setNewRoomTitle] = useState('')
    const [newMessage, setNewMessage] = useState('')
    const [newTaskTitle, setNewTaskTitle] = useState('')
    const [newTaskDesc, setNewTaskDesc] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [creatingRoom, setCreatingRoom] = useState(false)
    const [sendingMessage, setSendingMessage] = useState(false)
    const [creatingTask, setCreatingTask] = useState(false)
    const [invokingAgent, setInvokingAgent] = useState(false)
    const [savingAgents, setSavingAgents] = useState(false)
    const [atMentionOpen, setAtMentionOpen] = useState(false)
    const [atMentionFilter, setAtMentionFilter] = useState('')
    const [atMentionHighlight, setAtMentionHighlight] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const atListRef = useRef<HTMLDivElement>(null)
    const messageListRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = messageListRef.current
        if (el) el.scrollTop = el.scrollHeight
    }, [messages])

    const loadRooms = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const list = await mindApi.listRooms()
            setRooms(list)
            if (list.length > 0 && !selectedRoomId) {
                setSelectedRoomId(list[0].id)
            }
        } catch (e) {
            setError(String(e))
        } finally {
            setLoading(false)
        }
    }, [selectedRoomId])

    const loadMessages = useCallback(async (roomId: string) => {
        try {
            const list = await mindApi.listMessages(roomId)
            setMessages(list)
        } catch (e) {
            setError(String(e))
        }
    }, [])

    const loadTasks = useCallback(async (roomId: string) => {
        try {
            const list = await mindApi.listTasks(roomId)
            setTasks(list)
        } catch (e) {
            setError(String(e))
        }
    }, [])

    useEffect(() => {
        loadRooms()
    }, [loadRooms])

    const loadAgents = useCallback(async () => {
        try {
            const list = await agentApi.list()
            setAgents(list)
            setSelectedAgentId((cur) =>
                list.length > 0 && !list.some((a) => a.id === cur)
                    ? list[0].id
                    : cur
            )
        } catch {
            // ignore
        }
    }, [])

    useEffect(() => {
        loadAgents()
    }, [loadAgents])

    useEffect(() => {
        if (selectedRoomId) {
            loadMessages(selectedRoomId)
            loadTasks(selectedRoomId)
        } else {
            setMessages([])
            setTasks([])
        }
    }, [selectedRoomId, loadMessages, loadTasks])

    const handleCreateRoom = async () => {
        const title = newRoomTitle.trim()
        if (!title) return
        setCreatingRoom(true)
        setError(null)
        try {
            const room = await mindApi.createRoom(title)
            setRooms((prev) => [room, ...prev])
            setSelectedRoomId(room.id)
            setNewRoomTitle('')
        } catch (e) {
            setError(String(e))
        } finally {
            setCreatingRoom(false)
        }
    }

    const handleSendMessage = async () => {
        const content = newMessage.trim()
        if (!content || !selectedRoomId) return
        setSendingMessage(true)
        setError(null)
        const mentionedAgentId = extractLastMentionAgentId(content, agents)
        // 若 @ 了某人：只由该 Agent 回复；否则由本房间内所有 Agent 共享上下文并依次回复
        const agentsToInvoke: string[] =
            mentionedAgentId
                ? [mentionedAgentId]
                : roomAgentIds.length > 0
                  ? [...roomAgentIds]
                  : agents.map((a) => a.id)
        try {
            const msg = await mindApi.appendMessage(
                selectedRoomId,
                'human',
                'me',
                content
            )
            setMessages((prev) => [...prev, msg])
            setNewMessage('')

            if (agentsToInvoke.length > 0) {
                setInvokingAgent(true)
                const errors: string[] = []
                try {
                    for (let i = 0; i < agentsToInvoke.length; i++) {
                        if (i > 0) {
                            await new Promise((r) => setTimeout(r, 2000))
                        }
                        const agentId = agentsToInvoke[i]
                        try {
                            const agentMsg = await mindApi.invokeAgent(
                                selectedRoomId,
                                agentId
                            )
                            setMessages((prev) => [...prev, agentMsg])
                        } catch (e) {
                            errors.push(
                                `${agents.find((a) => a.id === agentId)?.name || agentId}: ${String(e)}`
                            )
                        }
                    }
                    if (errors.length > 0) {
                        setError(errors.join('\n'))
                    }
                } finally {
                    setInvokingAgent(false)
                }
            }
        } catch (e) {
            setError(String(e))
        } finally {
            setSendingMessage(false)
        }
    }

    const handleCreateTask = async () => {
        const title = newTaskTitle.trim()
        if (!title || !selectedRoomId) return
        setCreatingTask(true)
        setError(null)
        try {
            const task = await mindApi.createTask(
                selectedRoomId,
                title,
                newTaskDesc.trim(),
                []
            )
            setTasks((prev) => [...prev, task])
            setNewTaskTitle('')
            setNewTaskDesc('')
        } catch (e) {
            setError(String(e))
        } finally {
            setCreatingTask(false)
        }
    }

    const handleTaskStatusChange = async (taskId: string, status: string) => {
        try {
            const updated = await mindApi.updateTaskStatus(taskId, status)
            setTasks((prev) =>
                prev.map((t) => (t.id === taskId ? updated : t))
            )
        } catch (e) {
            setError(String(e))
        }
    }

    const selectedRoom = rooms.find((r) => r.id === selectedRoomId)
    const roomAgentIds = selectedRoom?.agent_ids ?? []

    const handleToggleRoomAgent = async (agentId: string) => {
        if (!selectedRoomId) return
        const next = roomAgentIds.includes(agentId)
            ? roomAgentIds.filter((id) => id !== agentId)
            : [...roomAgentIds, agentId]
        setSavingAgents(true)
        setError(null)
        try {
            const updated = await mindApi.updateRoomAgents(selectedRoomId, next)
            setRooms((prev) =>
                prev.map((r) => (r.id === selectedRoomId ? updated : r))
            )
        } catch (e) {
            setError(String(e))
        } finally {
            setSavingAgents(false)
        }
    }

    const roomAgents = agents.filter((a) => roomAgentIds.includes(a.id))

    // @ 成员列表：仅 Agent（选谁回复），带头像+名字
    const atMemberList = agents.map((a) => ({
        id: a.id,
        name: a.name?.trim() || a.id,
    }))
    const atFilteredList = atMentionFilter.trim()
        ? atMemberList.filter((m) =>
              m.name.toLowerCase().includes(atMentionFilter.toLowerCase())
          )
        : atMemberList
    const atHighlightIndex = Math.min(
        Math.max(0, atMentionHighlight),
        atFilteredList.length - 1
    )

    const handleMessageChange = (value: string) => {
        setNewMessage(value)
        const lastAt = value.lastIndexOf('@')
        if (lastAt !== -1) {
            setAtMentionOpen(true)
            setAtMentionFilter(value.slice(lastAt + 1))
            setAtMentionHighlight(0)
        } else {
            setAtMentionOpen(false)
            setAtMentionFilter('')
        }
    }

    const handleSelectAtMember = (agentId: string, displayName: string) => {
        const lastAt = newMessage.lastIndexOf('@')
        const beforeAt = lastAt !== -1 ? newMessage.slice(0, lastAt) : newMessage
        setNewMessage(`${beforeAt}@${displayName} `)
        setSelectedAgentId(agentId)
        setAtMentionOpen(false)
        setAtMentionFilter('')
        inputRef.current?.focus()
    }

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        if (atMentionOpen) {
            if (e.key === 'Escape') {
                setAtMentionOpen(false)
                e.preventDefault()
                return
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setAtMentionHighlight((i) =>
                    i >= atFilteredList.length - 1 ? 0 : i + 1
                )
                return
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault()
                setAtMentionHighlight((i) =>
                    i <= 0 ? atFilteredList.length - 1 : i - 1
                )
                return
            }
            if (e.key === 'Enter' && atFilteredList.length > 0) {
                e.preventDefault()
                const item = atFilteredList[atHighlightIndex]
                if (item) handleSelectAtMember(item.id, item.name)
                return
            }
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            handleSendMessage()
        }
    }

    return (
        <div className="h-full flex flex-col p-4">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-semibold text-white">
                    团队房间 · Mind 协作
                </h1>
            </div>

            {error && (
                <div className="mb-4 px-4 py-2 bg-red-900/30 border border-red-700 rounded-lg text-red-200 text-sm">
                    {error}
                </div>
            )}

            <div className="flex-1 flex gap-4 min-h-0">
                {/* 左侧：房间列表 */}
                <div className="w-56 flex-shrink-0 flex flex-col bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                    <div className="p-3 border-b border-gray-800 flex gap-2">
                        <input
                            type="text"
                            placeholder="新建房间"
                            value={newRoomTitle}
                            onChange={(e) => setNewRoomTitle(e.target.value)}
                            onKeyDown={(e) =>
                                e.key === 'Enter' && handleCreateRoom()
                            }
                            className="flex-1 px-3 py-2 rounded-lg bg-gray-800 text-gray-200 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            onClick={handleCreateRoom}
                            disabled={creatingRoom || !newRoomTitle.trim()}
                            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {creatingRoom ? '…' : '新建'}
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        {loading ? (
                            <div className="text-gray-500 text-sm py-4 text-center">
                                加载中…
                            </div>
                        ) : rooms.length === 0 ? (
                            <div className="text-gray-500 text-sm py-4 text-center">
                                暂无房间
                            </div>
                        ) : (
                            rooms.map((r) => (
                                <button
                                    key={r.id}
                                    onClick={() => setSelectedRoomId(r.id)}
                                    className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors ${
                                        selectedRoomId === r.id
                                            ? 'bg-blue-600/30 text-blue-200'
                                            : 'text-gray-300 hover:bg-gray-800'
                                    }`}
                                >
                                    {r.title || '未命名房间'}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* 中间：消息流 */}
                <div className="flex-1 flex flex-col bg-gray-900 rounded-xl border border-gray-800 overflow-hidden min-w-0">
                    {selectedRoom ? (
                        <>
                            <div className="px-4 py-3 border-b border-gray-800">
                                <h2 className="font-medium text-white">
                                    {selectedRoom.title || '未命名房间'}
                                </h2>
                                <div className="mt-2">
                                    <span className="text-xs text-gray-500">本房间 Agent：</span>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {agents.length === 0 ? (
                                            <span className="text-xs text-gray-500">暂无 Agent，请在 Agent 管理中添加</span>
                                        ) : (
                                            agents.map((a) => (
                                                <label
                                                    key={a.id}
                                                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs cursor-pointer transition-colors ${
                                                        roomAgentIds.includes(a.id)
                                                            ? 'bg-blue-600/40 text-blue-100'
                                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                                    } ${savingAgents ? 'opacity-60' : ''}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={roomAgentIds.includes(a.id)}
                                                        onChange={() => handleToggleRoomAgent(a.id)}
                                                        disabled={savingAgents}
                                                        className="rounded border-gray-500"
                                                    />
                                                    {a.name || a.id}
                                                </label>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div
                                ref={messageListRef}
                                className="flex-1 overflow-y-auto p-4 space-y-4"
                            >
                                {messages.map((m) => {
                                    const isHuman = m.sender_type === 'human'
                                    const displayName = getMemberDisplayName(
                                        m.sender_type,
                                        m.sender_id,
                                        agents
                                    )
                                    const letter = getAvatarLetter(
                                        m.sender_type,
                                        m.sender_id,
                                        agents
                                    )
                                    const bgColor = isHuman
                                        ? avatarBgColor('me')
                                        : avatarBgColor(m.sender_id)
                                    return (
                                        <div
                                            key={m.id}
                                            className={`flex gap-3 ${isHuman ? 'flex-row-reverse' : ''}`}
                                        >
                                            <div
                                                className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-medium"
                                                style={{ backgroundColor: bgColor }}
                                                title={displayName}
                                            >
                                                {letter}
                                            </div>
                                            <div
                                                className={`flex-1 min-w-0 flex flex-col ${isHuman ? 'items-end' : 'items-start'}`}
                                            >
                                                <div className="text-xs text-gray-500 mb-0.5">
                                                    {displayName}
                                                    <span className="ml-1.5">
                                                        {formatTime(m.created_at)}
                                                    </span>
                                                </div>
                                                <div
                                                    className={`rounded-lg px-3 py-2 max-w-[85%] ${
                                                        isHuman
                                                            ? 'bg-blue-600/30 text-blue-100'
                                                            : 'bg-gray-800 text-gray-200'
                                                    }`}
                                                >
                                                    <div className="text-sm whitespace-pre-wrap">
                                                        {m.content}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                                {messages.length === 0 && (
                                    <div className="text-gray-500 text-sm text-center py-8">
                                        暂无消息，发送第一条消息吧
                                    </div>
                                )}
                            </div>
                            <div className="p-3 border-t border-gray-800 relative">
                                {atMentionOpen && atFilteredList.length > 0 && (
                                    <div
                                        ref={atListRef}
                                        className="absolute bottom-full left-3 right-14 mb-1 max-h-48 overflow-y-auto rounded-lg border border-gray-700 bg-gray-800 shadow-xl z-10"
                                    >
                                        {atFilteredList.map((m, i) => (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() =>
                                                    handleSelectAtMember(
                                                        m.id,
                                                        m.name
                                                    )
                                                }
                                                className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-700 ${
                                                    i === atHighlightIndex
                                                        ? 'bg-gray-700'
                                                        : ''
                                                }`}
                                            >
                                                <div
                                                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-medium"
                                                    style={{
                                                        backgroundColor:
                                                            avatarBgColor(m.id),
                                                    }}
                                                >
                                                    {m.name.charAt(0)}
                                                </div>
                                                <span className="text-sm text-gray-200">
                                                    {m.name}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <div className="flex gap-2 items-center">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        placeholder="输入消息，输入 @ 唤起成员列表…"
                                        value={newMessage}
                                        onChange={(e) =>
                                            handleMessageChange(e.target.value)
                                        }
                                        onKeyDown={handleInputKeyDown}
                                        className="flex-1 px-3 py-2 rounded-lg bg-gray-800 text-gray-200 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={
                                            sendingMessage ||
                                            invokingAgent ||
                                            !newMessage.trim()
                                        }
                                        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {sendingMessage || invokingAgent
                                            ? '…'
                                            : '发送'}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-500">
                            选择或新建一个房间
                        </div>
                    )}
                </div>

                {/* 右侧：任务列表 */}
                <div className="w-64 flex-shrink-0 flex flex-col bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                    <div className="p-3 border-b border-gray-800">
                        <span className="text-sm font-medium text-white">
                            任务
                        </span>
                    </div>
                    {selectedRoom && (
                        <>
                            <div className="p-3 border-b border-gray-800 space-y-2">
                                <input
                                    type="text"
                                    placeholder="任务标题"
                                    value={newTaskTitle}
                                    onChange={(e) =>
                                        setNewTaskTitle(e.target.value)
                                    }
                                    className="w-full px-3 py-2 rounded-lg bg-gray-800 text-gray-200 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <input
                                    type="text"
                                    placeholder="描述（可选）"
                                    value={newTaskDesc}
                                    onChange={(e) =>
                                        setNewTaskDesc(e.target.value)
                                    }
                                    className="w-full px-3 py-2 rounded-lg bg-gray-800 text-gray-200 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                    onClick={handleCreateTask}
                                    disabled={
                                        creatingTask || !newTaskTitle.trim()
                                    }
                                    className="w-full px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {creatingTask ? '…' : '添加任务'}
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                {tasks.map((t) => (
                                    <div
                                        key={t.id}
                                        className="p-3 rounded-lg bg-gray-800 border border-gray-700"
                                    >
                                        <div className="text-sm font-medium text-white mb-1">
                                            {t.title}
                                        </div>
                                        {t.description && (
                                            <div className="text-xs text-gray-400 mb-2">
                                                {t.description}
                                            </div>
                                        )}
                                        <select
                                            value={t.status}
                                            onChange={(e) =>
                                                handleTaskStatusChange(
                                                    t.id,
                                                    e.target.value
                                                )
                                            }
                                            className="w-full px-2 py-1 rounded bg-gray-700 text-gray-200 text-xs focus:outline-none"
                                        >
                                            <option value="todo">待办</option>
                                            <option value="in_progress">
                                                进行中
                                            </option>
                                            <option value="done">完成</option>
                                            <option value="blocked">阻塞</option>
                                        </select>
                                    </div>
                                ))}
                                {tasks.length === 0 && (
                                    <div className="text-gray-500 text-sm text-center py-4">
                                        暂无任务
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                    {!selectedRoom && (
                        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm p-4">
                            选择房间后查看任务
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
