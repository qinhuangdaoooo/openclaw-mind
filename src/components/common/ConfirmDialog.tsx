import type { ReactNode } from 'react'

interface ConfirmDialogProps {
    open: boolean
    title?: string
    description?: ReactNode
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
    onConfirm: () => void
    onCancel: () => void
}

export function ConfirmDialog({
    open,
    title = '确认操作',
    description,
    confirmLabel = '确认',
    cancelLabel = '取消',
    danger = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
                <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">{title}</h2>
                    <button
                        onClick={onCancel}
                        className="text-gray-500 hover:text-gray-300 text-sm"
                    >
                        ✕
                    </button>
                </div>
                <div className="px-4 py-3">
                    {description && (
                        <div className="text-xs text-gray-300 leading-relaxed">
                            {description}
                        </div>
                    )}
                </div>
                <div className="px-4 py-3 border-t border-gray-800 flex justify-end gap-2">
                    <button
                        onClick={onCancel}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            danger
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}

