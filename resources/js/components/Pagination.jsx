import { Link } from '@inertiajs/react';

export default function Pagination({ links }) {
    if (links.length <= 7) {
        return (
            <div className="flex flex-wrap justify-end mt-6">
                {links.map((link, index) => (
                    <Link
                        key={index}
                        href={link.url}
                        className={`mx-1 px-2 py-1 border rounded text-xs font-semibold ${
                            link.active ? 'bg-black-500 text-white' : 'bg-white text-black-500'
                        } ${!link.url ? 'text-gray-400 cursor-not-allowed' : ''}`}
                        dangerouslySetInnerHTML={{ __html: link.label }}
                    />
                ))}
            </div>
        );
    }

    const createEllipsis = () => ({
        url: null,
        label: '...',
        active: false,
    });

    let filteredLinks = [];
    const currentIndex = links.findIndex(link => link.active);
    const lastPageIndex = links.length - 2;

    // 1. Previous button
    filteredLinks.push(links[0]);

    // 2. First page
    filteredLinks.push(links[1]);

    // 3. Intermediate 1
    const intermediate1Index = Math.floor((1 + currentIndex) / 2);
    if (intermediate1Index > 2) {
        filteredLinks.push(createEllipsis());
    }
    if (intermediate1Index > 1 && intermediate1Index < currentIndex) {
        filteredLinks.push(links[intermediate1Index]);
    }

    // 4. Current page and its neighbours
    if (currentIndex > 1 && currentIndex < lastPageIndex) {
        if (currentIndex - 1 > intermediate1Index && currentIndex -1 > 1) {
             if (filteredLinks[filteredLinks.length - 1].label !== '...') {
                filteredLinks.push(createEllipsis());
             }
        }
        filteredLinks.push(links[currentIndex]);
    }

    // 5. Intermediate 2
    const intermediate2Index = Math.floor((currentIndex + lastPageIndex) / 2);
     if (intermediate2Index > currentIndex && intermediate2Index < lastPageIndex) {
        if (currentIndex + 1 < intermediate2Index) {
            if (filteredLinks[filteredLinks.length - 1].label !== '...') {
                filteredLinks.push(createEllipsis());
            }
        }
        filteredLinks.push(links[intermediate2Index]);
    }

    // 6. Last page
    if (lastPageIndex > intermediate2Index) {
        if (filteredLinks[filteredLinks.length - 1].label !== '...') {
            filteredLinks.push(createEllipsis());
        }
    }
    filteredLinks.push(links[lastPageIndex]);

    // 7. Next button
    filteredLinks.push(links[links.length - 1]);

    // Remove duplicate links (especially page 1 and last page)
    const uniqueLinks = filteredLinks.filter((link, index, self) =>
        index === self.findIndex((t) => (
            t.label === link.label && t.url === link.url
        ))
    );

    return (
        <div className="flex flex-wrap justify-end mt-6">
            {uniqueLinks.map((link, index) => (
                <Link
                    key={index}
                    href={link.url}
                    className={`mx-1 px-2 py-1 border rounded text-xs font-semibold ${
                        link.active ? 'bg-black-500 text-white' : 'bg-white text-black-500'
                    } ${!link.url ? 'text-gray-400 cursor-not-allowed' : ''}`}
                    dangerouslySetInnerHTML={{ __html: link.label }}
                />
            ))}
        </div>
    );
}
