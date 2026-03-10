'use client'

export interface ValidationIssue {
    type: 'error' | 'warning'
    key: string
    message: string
}

interface ValidationBannerProps {
    issues: ValidationIssue[]
}

export function ValidationBanner({ issues }: ValidationBannerProps) {
    if (issues.length === 0) return null

    const hasErrors = issues.some((i) => i.type === 'error')

    return (
        <div
            className={`rounded-lg border px-4 py-3 space-y-1.5 ${hasErrors
                    ? 'border-red-700/30 bg-red-900/10'
                    : 'border-amber-700/20 bg-amber-900/10'
                }`}
        >
            <div className="flex items-center gap-2">
                <span className={`text-sm shrink-0 ${hasErrors ? 'text-red-400' : 'text-amber-400'}`}>
                    {hasErrors ? '⚠️' : '⚠'}
                </span>
                <p className={`text-xs font-semibold ${hasErrors ? 'text-red-400' : 'text-amber-400'}`}>
                    {hasErrors
                        ? `${issues.filter((i) => i.type === 'error').length} 个错误需修复（无法保存）`
                        : `${issues.length} 条配置建议`}
                </p>
            </div>
            <ul className="space-y-1">
                {issues.map((issue) => (
                    <li key={issue.key} className="flex items-start gap-1.5">
                        <span
                            className={`text-xs shrink-0 mt-0.5 ${issue.type === 'error' ? 'text-red-400' : 'text-amber-400'
                                }`}
                        >
                            {issue.type === 'error' ? '✕' : '⚠'}
                        </span>
                        <span
                            className={`text-xs leading-relaxed ${issue.type === 'error' ? 'text-red-400/90' : 'text-amber-400/80'
                                }`}
                        >
                            {issue.message}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    )
}
