import { useState } from 'react';

export default function TagInput({ value = [], onChange, suggestions = [], id = 'slug' }) {
    const [input, setInput] = useState('');
    const add = (raw) => {
        const tag = raw.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
        if (tag.length >= 3 && !value.includes(tag)) onChange([...value, tag]);
        setInput('');
    };
    const keyDown = (event) => {
        if (['Enter', ',', 'Tab'].includes(event.key) && input.trim()) {
            event.preventDefault(); add(input);
        } else if (event.key === 'Backspace' && !input && value.length) {
            onChange(value.slice(0, -1));
        }
    };

    return (
        <div id={id} className="mt-1 flex min-h-[42px] w-full flex-wrap gap-2 rounded-md border border-gray-300 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
            {value.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-1 text-xs text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100">
                    {tag}
                    <button type="button" onClick={() => onChange(value.filter((item) => item !== tag))} aria-label={`Remove ${tag}`}>&times;</button>
                </span>
            ))}
            <input
                className="min-w-[120px] flex-1 border-0 bg-transparent p-0 text-sm focus:ring-0 dark:text-gray-100"
                value={input}
                list={`${id}-suggestions`}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={keyDown}
                onBlur={() => input.trim() && add(input)}
                placeholder="Type a keyword and press Enter"
            />
            <datalist id={`${id}-suggestions`}>{suggestions.map((tag) => <option key={tag} value={tag} />)}</datalist>
        </div>
    );
}
