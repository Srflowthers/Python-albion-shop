@echo off
rem Script para construir la aplicación y el instalador de Windows
setlocal

if exist .venv\Scripts\activate.bat (
    call .venv\Scripts\activate.bat
) else (
    echo ERROR: no se encontro el entorno virtual .venv. Active su entorno o cree uno.
    exit /b 1
)

echo [1/5] Construyendo el frontend...
cd frontend
if not exist package.json (
    echo ERROR: no se encontro frontend\package.json
    exit /b 1
)
call npm install
call npm run build || (
    echo ERROR: falló npm run build
    exit /b 1
)
cd ..

echo [2/5] Instalando dependencias de Python necesarias...
pip install pyinstaller requests pywebview pillow winrt-Windows.Media.Ocr winrt-Windows.Graphics.Imaging winrt-Windows.Storage winrt-Windows.Storage.Streams winrt-runtime pygetwindow || (
    echo ERROR: falló la instalación de dependencias de Python
    exit /b 1
)

echo [3/5] Generando logo.ico desde logo.png...
if not exist logo.png (
    echo ERROR: no se encontro logo.png en la raiz del proyecto
    exit /b 1
)
python generate_icon.py || (
    echo ERROR: no se pudo generar logo.ico desde logo.png
    exit /b 1
)
copy /Y logo.ico frontend\public\favicon.ico >nul
copy /Y logo.png frontend\public\logo.png >nul

echo [4/5] Creando el ejecutable con PyInstaller...
python -m PyInstaller --noconfirm --clean App.spec || (
    echo ERROR: falló PyInstaller
    exit /b 1
)

if not exist dist\AlbionMarket\AlbionMarket.exe (
    echo ERROR: no se encontro dist\AlbionMarket\AlbionMarket.exe
    exit /b 1
)

if exist logo.ico (
    copy /Y logo.ico dist\AlbionMarket\logo.ico >nul
)

echo [5/5] Creando el instalador NSIS...
set "MAKENSIS_CMD=makensis"
where makensis >nul 2>&1
if errorlevel 1 (
    if exist "C:\Program Files (x86)\NSIS\makensis.exe" (
        set "MAKENSIS_CMD=C:\Program Files (x86)\NSIS\makensis.exe"
    ) else if exist "C:\Program Files\NSIS\makensis.exe" (
        set "MAKENSIS_CMD=C:\Program Files\NSIS\makensis.exe"
    ) else (
        echo ADVERTENCIA: makensis no está instalado. Instale NSIS para generar el instalador.
        echo El ejecutable está listo en dist\AlbionMarket\AlbionMarket.exe
        exit /b 0
    )
)

"%MAKENSIS_CMD%" setup_albion_market.nsi || (
    echo ERROR: falló la creación del instalador con NSIS
    exit /b 1
)

echo Instalador generado correctamente.
echo Resultado: AlbionMarketInstaller.exe
exit /b 0
