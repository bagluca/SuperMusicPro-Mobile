@echo off
title SuperMusicPro Android Stream Server
echo ========================================================
echo  SuperMusicPro - Server di Streaming per Android
echo  In ascolto su http://0.0.0.0:4545
echo  IP Wi-Fi Locale: http://192.168.1.33:4545
echo ========================================================
"C:\Users\lucab\.gemini\antigravity\scratch\SuperMusic\venv\Scripts\python.exe" server.py 4545
pause
