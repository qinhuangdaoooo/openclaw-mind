'use client'

import { windowApi } from '@/lib/tauri'

export default function TitleBar() {
    return (
        <div
            data-tauri-drag-region
            className="h-8 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 select-none"
        >
            <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-300">openClaw-mind</span>
            </div>

            <div className="flex items-center gap-1">
                <button
                    onClick={() => windowApi.minimize()}
                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-800 rounded transition-colors"
                    title="最小化"
                >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                </button>

                <button
                    onClick={() => windowApi.maximize()}
                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-800 rounded transition-colors"
                    title="最大化"
                >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                </button>

                <button
                    onClick={() => windowApi.close()}
                    className="w-8 h-8 flex items-center justify-center hover:bg-red-600 rounded transition-colors"
                    title="关闭"
                >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    )
}
