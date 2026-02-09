const fs = require('fs');

try {
    const buffer = fs.readFileSync('dump_restaurante.db');
    const content = buffer.toString('utf8');

    // Match any sequence of printable characters length 4 or more
    // Including spaces, Spanish chars
    const allStrings = content.match(/[a-zA-Z0-9 ÁÉÍÓÚáéíóúñÑ$.:]{4,}/g);

    if (allStrings) {
        console.log('--- STRINGS FOUND ---');
        // Filter out common code junk
        const filtered = allStrings.filter(s => !s.match(/^(sqlite|table|index|CREATE|UPDATE|DELETE|INSERT|NULL|INTEGER|REAL|TEXT|BLOB|trigger|primary|autoincrement|sequence|master)/i));

        // Print unique
        const unique = [...new Set(filtered)];
        console.log(unique.join('\n'));
    } else {
        console.log('No strings found.');
    }

} catch (e) {
    console.error(e);
}
