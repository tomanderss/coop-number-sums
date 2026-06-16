@echo off
echo.
echo  ===================================================
echo   Coop Number Sums - Build ^& Deploy (GitHub Pages)
echo  ===================================================
echo.

cd /d "%~dp0"

:: Buildinfo generieren (Version + Changelog + SW-Cache)
echo  [1/4] buildinfo.js generieren...
node build.js
if %ERRORLEVEL% neq 0 (
  echo  FEHLER: node build.js fehlgeschlagen!
  pause
  exit /b 1
)
echo.

:: Alle Aenderungen stagen
echo  [2/4] Git add...
git add -A
echo.

:: Commit mit Zeitstempel
echo  [3/4] Commit...
for /f "tokens=1-3 delims=." %%a in ("%DATE%") do set D=%%a.%%b.%%c
for /f "tokens=1-2 delims=:" %%a in ("%TIME: =0%") do set T=%%a:%%b
git commit -m "Deploy %D% %T%"
echo.

:: Push (GitHub Pages deployt automatisch vom master-Branch)
echo  [4/4] Push...
git push
if %ERRORLEVEL% neq 0 (
  echo  FEHLER: git push fehlgeschlagen!
  pause
  exit /b 1
)
echo.

echo  ===================================================
echo   Deploy abgeschlossen!
echo  ===================================================
echo.
pause
