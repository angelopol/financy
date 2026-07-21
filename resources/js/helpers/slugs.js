export function descriptionTags(value) {
    return [...new Set(value
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 3))];
}
