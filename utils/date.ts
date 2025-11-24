
export const formatDate = (dateString: string): string => {
    if (!dateString) return '';

    let date: Date;
    // Check if it matches YYYY-MM-DD format exactly
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [year, month, day] = dateString.split('-').map(Number);
        date = new Date(Date.UTC(year, month - 1, day));
    } else {
        date = new Date(dateString);
    }

    if (isNaN(date.getTime())) return dateString;

    const d = date.getUTCDate().toString().padStart(2, '0');
    const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const y = date.getUTCFullYear();
    return `${d}/${m}/${y}`;
};

export const formatDateExtended = (dateString: string): string => {
    if (!dateString) return '';

    let date: Date;
    // Check if it matches YYYY-MM-DD format exactly
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [year, month, day] = dateString.split('-').map(Number);
        date = new Date(Date.UTC(year, month - 1, day));
    } else {
        date = new Date(dateString);
    }

    if (isNaN(date.getTime())) return dateString;

    const d = date.getUTCDate().toString().padStart(2, '0');
    const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const y = date.getUTCFullYear();

    const verbose = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

    return `${d}/${m}/${y} (${verbose})`;
};
