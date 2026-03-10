interface SegmentedControlProps {
    value: string
    options: { value: string; label: string }[]
    onChange: (value: string) => void
    compact?: boolean
}

export function SegmentedControl({ value, options, onChange, compact }: SegmentedControlProps) {
    return (
        <div className={`flex items-center gap-1 bg-gray-900/40 rounded-lg p-1 w-fit ${compact ? 'text-xs' : ''}`}>
            {options.map((option) => (
                <button
                    key={option.value}
                    onClick={() => onChange(option.value)}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all ${compact ? 'text-xs' : 'text-sm'
                        } ${value === option.value
                            ? 'bg-gray-800 text-white shadow-sm'
                            : 'text-gray-400 hover:text-white'
                        }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    )
}
