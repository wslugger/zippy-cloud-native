export function normalizeDesignOptionKey(key: string) {
    return key.trim().toLowerCase().replace(/\s+/g, '_');
}

export function parseList(text: string): string[] {
    return text
        .split('\n')
        .map((entry) => entry.trim())
        .filter(Boolean);
}

export function sanitizeList(values: string[]): string[] {
    return values.map((value) => value.trim()).filter(Boolean);
}
