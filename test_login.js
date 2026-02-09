const { app } = require('electron');
const path = require('path');
const DatabaseManager = require('./src/main/database');

app.whenReady().then(async () => {
    try {
        const fs = require('fs');
        const util = require('util');
        const logFile = fs.createWriteStream('test_output.log', { flags: 'w' });
        const logStdout = process.stdout;
        const logStderr = process.stderr;

        console.log = function () {
            logFile.write(util.format.apply(null, arguments) + '\n');
            logStdout.write(util.format.apply(null, arguments) + '\n');
        }
        console.error = function () {
            logFile.write('[ERROR] ' + util.format.apply(null, arguments) + '\n');
            logStderr.write(util.format.apply(null, arguments) + '\n');
        }

        console.log('--- STARTING TEST ---');
        console.log('User Data Path:', app.getPath('userData'));

        const realPath = 'C:\\Users\\quiro\\AppData\\Roaming\\pos-restaurante-tacos\\restaurante.json';
        console.log('Forcing path:', realPath);
        const db = new DatabaseManager(realPath);
        await db.initDatabase();

        console.log('--- DB INITIALIZED ---');
        console.log('Admins List (METHOD):', JSON.stringify(db.getAdministradores(), null, 2));
        console.log('Admins List (DIRECT):', JSON.stringify(db.data.administradores, null, 2));

        const pinToTest = '1234';
        const { hashPin } = require('./src/main/security');
        const generatedHash = await hashPin(pinToTest);
        console.log('GENERATED REAL HASH:', generatedHash);

        console.log(`--- TESTING PIN: ${pinToTest} ---`);

        const result = await db.validateAdminPin(pinToTest);
        console.log('VALIDATION RESULT:', JSON.stringify(result, null, 2));

        if (result.success) {
            console.log('SUCCESS: Login Verified!');
        } else {
            console.log('FAILURE: Login Rejected.');
        }

    } catch (err) {
        console.error('CRITICAL ERROR:', err);
        const fs = require('fs');
        fs.writeFileSync('test_debug_error.log', err.toString() + '\n' + (err.stack || ''));
    } finally {
        app.quit();
    }
});
