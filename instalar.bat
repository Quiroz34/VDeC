@echo off
echo ========================================
echo Sistema POS - Instalacion de Dependencias
echo ========================================
echo.

echo Limpiando cache de npm...
call npm cache clean --force

echo.
echo Eliminando node_modules anterior...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json

echo.
echo Instalando Electron...
call npm install electron@27.0.0 --save-dev

echo.
echo Instalando Better-SQLite3...
call npm install better-sqlite3@9.0.0 --save --build-from-source

echo.
echo ========================================
echo Instalacion completada!
echo ========================================
echo.
echo Para iniciar la aplicacion ejecuta: npm start
echo.
pause
