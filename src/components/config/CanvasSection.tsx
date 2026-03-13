'use client'

import { FieldGroup } from './FieldGroup'
import { FormSection } from './FormSection'

interface CanvasSectionProps {
    canvasHost: { enabled?: boolean; port?: number } | undefined
    setCanvasEnabled: (enabled: boolean) => void
    setCanvasPort: (port: number) => void
}

export function CanvasSection({ canvasHost, setCanvasEnabled, setCanvasPort }: CanvasSectionProps) {
    return (
        <FormSection
            title="Canvas 服务 (canvasHost)"
            description="为 ~/.openclaw/workspace/canvas 提供 HTTP 文件服务，默认端口 gateway.port + 4"
        >
            <div className="space-y-3">
                <div className="flex items-center justify-between py-0.5">
                    <div>
                        <p className="text-sm font-medium text-white">启用 Canvas 服务</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            可设置 OPENCLAW_SKIP_CANVAS_HOST=1 全局禁用
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={canvasHost?.enabled !== false}
                            onChange={(e) => setCanvasEnabled(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
                {canvasHost?.enabled !== false && (
                    <FieldGroup
                        label="端口 (port)"
                        description={`访问路径：http://127.0.0.1:${canvasHost?.port ?? 18793}/__openclaw__/canvas/`}
                    >
                        <input
                            type="number"
                            value={canvasHost?.port ?? 18793}
                            onChange={(e) => setCanvasPort(Number(e.target.value))}
                            placeholder="18793"
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                        />
                    </FieldGroup>
                )}
            </div>
        </FormSection>
    )
}
