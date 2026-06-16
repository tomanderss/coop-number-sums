@echo off
echo.
echo  ===================================================
echo   Coop Number Sums - Lokaler Server
echo  ===================================================
echo.

REM Eigene IP-Adresse ermitteln
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP: =%

echo  Server laeuft auf:
echo.
echo    Dieser PC:  http://localhost:8080
echo    iPhone:     http://%IP%:8080
echo.
echo  iPhone: Safari oeffnen, obige Adresse eingeben,
echo          dann Teilen -^> Zum Home-Bildschirm
echo.
echo  Fenster schliessen = Server stoppen
echo  ===================================================
echo.

cd /d "%~dp0"
python -m http.server 8080
