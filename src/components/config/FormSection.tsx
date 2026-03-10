import type { ReactNode } from 'react'

interface FormSectionProps {
    title: string
    description?: string
    action?: ReactNode
    children: ReactNode
}

export function FormSection({ title, description, action, children }: FormSectionProps) {
    return (
        <section className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-700 bg-gray-800/50">
                <div>
                    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {title}
                    </h2>
                    {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
                </div>
                {action && <div className="shrink-0">{action}</div>}
            </div>
            <div className="p-4">{children}</div>
        </section>
    )
}
