import { Link } from '@inertiajs/react';

export default function Pagination({ links }) {
    return (
        <div className="flex justify-end mt-6">
            {links.map((link, index) => (
                <Link
                    key={index}
                    href={link.url}
                    className={`mx-1 px-2 py-1 border rounded text-xs font-semibold ${
                        link.active ? 'bg-black-500 text-white' : 'bg-white text-black-500'
                    }`}
                    dangerouslySetInnerHTML={{ __html: link.label }}
                />
            ))}
        </div>
    );
}
