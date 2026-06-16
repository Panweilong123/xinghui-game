@echo off
cd /d "%~dp0"
py -3 stardash.py
if errorlevel 1 (
  python stardash.py
)
