import { Link } from '@inertiajs/react';

export default function Pagination({ links }) {
    // Filtrar solo los links relevantes para mostrar máximo 3 páginas (anterior, actual, siguiente)
    let filteredLinks = [];
    const currentIndex = links.findIndex(link => link.active);

    // Siempre mostrar el link de anterior si existe
    if (links[0] && links[0].label.toLowerCase().includes('Previous')) {
        filteredLinks.push(links[0]);
    }

    // Mostrar hasta 3 páginas: anterior, actual, siguiente
    for (let i = currentIndex - 1; i <= currentIndex + 1; i++) {
        if (i > 0 && i < links.length - 1) {
            filteredLinks.push(links[i]);
        }
    }

    // Siempre mostrar el link de siguiente si existe
    if (links[links.length - 1] && links[links.length - 1].label.toLowerCase().includes('Next')) {
        filteredLinks.push(links[links.length - 1]);
    }

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
