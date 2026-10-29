@echo off
title Simulatore Android Auto - SuperMusic PRO
echo ========================================================
echo   Avvio simulatore Android Auto (Desktop Head Unit)
echo ========================================================
echo.
echo 1. Assicurati che lo smartphone sia collegato via USB con Debug USB attivo.
echo 2. Sullo smartphone in Android Auto:
echo    - Impostazioni > Android Auto > tocca 10 volte "Versione"
echo    - Menu a 3 puntini in alto > "Avvia server head unit"
echo.
echo Reindirizzamento porta ADB (tcp:5277)...
adb forward tcp:5277 tcp:5277
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRORE] Impossibile inoltrare la porta ADB. Controlla che il telefono sia connesso.
    pause
    exit /b %ERRORLEVEL%
)

echo Connessione stabilita con successo!
echo Avvio della schermata Android Auto sul PC...
cd /d "C:\Users\lucab\AppData\Local\Android\Sdk\extras\google\auto"
start desktop-head-unit.exe
