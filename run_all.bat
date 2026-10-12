@echo off
title Campus Food Delivery Launcher

echo ========================================================
echo       Campus Food Delivery System Launcher
echo ========================================================
echo.

echo [1/3] Starting Backend Server (Port 5000)...
start "Campus Delivery - Backend API" cmd /k "cd /d "%~dp0backend" && npm run dev"

ping 127.0.0.1 -n 4 > nul

echo [2/3] Starting Restaurant Desktop App (Port 5173)...
start "Campus Delivery - Restaurant Desktop" cmd /k "cd /d "%~dp0desktop-app" && npm run dev"

ping 127.0.0.1 -n 3 > nul

echo [3/3] Starting Customer Web App (Port 3000)...
start "Campus Delivery - Customer App" cmd /k "cd /d "%~dp0customer-app" && npm run dev"

echo.
echo ========================================================
echo All services launched in separate windows!
echo.
echo [1] On this PC (Local):
echo     - Customer App:        http://localhost:3000
echo     - Super Admin Portal:  http://localhost:3000/admin
echo     - Restaurant Desktop:  http://localhost:5173
echo     - Backend API:         http://localhost:5000
echo.
echo [2] On Mobile / Network (Same Wi-Fi):
echo     - Open on your Phone:  http://192.168.1.221:3000
echo     - Admin on Phone:      http://192.168.1.221:3000/admin
echo ========================================================
echo.
pause
