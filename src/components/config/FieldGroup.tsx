interface FieldGroupProps {
    label: string
    description?: string
    children: React.ReactNode
    required?: boolean
}

export function FieldGroup({ label, description, children, required }: FieldGroupProps) {
    return (
        <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-300">
                {label}
                {required && <span className="text-red-400 ml-1">*</span>}
            </label>
            {description && (
                <p className="text-xs text-gray-500">{description}</p>
            )}
            {children}
        </div>
    )
}
