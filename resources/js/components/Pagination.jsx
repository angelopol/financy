import { Link } from '@inertiajs/react';

export default function Pagination({ links }) {
    let filteredLinks = [];
    const currentIndex = links.findIndex(link => link.active);

    filteredLinks.push(links[0]);

    for (let i = currentIndex - 1; i <= currentIndex + 1; i++) {
        if (i > 0 && i < links.length - 1) {
            filteredLinks.push(links[i]);
        }
    }

    filteredLinks.push(links[links.length - 1]);

    return (
        <div className="flex flex-wrap justify-end mt-6">
            {filteredLinks.map((link, index) => (
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
