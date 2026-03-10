'use client'

import { useState } from 'react'

interface TagInputProps {
    values: string[]
    onChange: (values: string[]) => void
    placeholder?: string
}

export function TagInput({ values, onChange, placeholder }: TagInputProps) {
    const [input, setInput] = useState('')

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && input.trim()) {
            e.preventDefault()
            if (!values.includes(input.trim())) {
                onChange([...values, input.trim()])
            }
            setInput('')
        } else if (e.key === 'Backspace' && !input && values.length > 0) {
            onChange(values.slice(0, -1))
        }
    }

    const removeTag = (index: number) => {
        onChange(values.filter((_, i) => i !== index))
    }

    return (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus-within:border-blue-500 transition-colors">
            {values.map((value, index) => (
                <span
                    key={index}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded-md"
                >
                    {value}
                    <button
                        onClick={() => removeTag(index)}
                        className="hover:text-blue-300 transition-colors"
                    >
                        ×
                    </button>
                </span>
            ))}
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={values.length === 0 ? placeholder : ''}
                className="flex-1 min-w-[120px] bg-transparent text-white text-sm focus:outline-none placeholder:text-gray-600"
            />
        </div>
    )
}
