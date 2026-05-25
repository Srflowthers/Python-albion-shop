# Instalador de Albion Market

Este proyecto ahora incluye los archivos necesarios para generar un instalador de Windows con icono personalizado.

## Pasos para crear el instalador

1. Active su entorno virtual de Python:
   - `.\.venv\Scripts\activate.bat`

2. Genere el build del frontend:
   - `cd frontend`
   - `npm install`
   - `npm run build`
   - `cd ..`

3. Instale las dependencias de Python necesarias:
   - `pip install pyinstaller requests pywebview pillow`

4. Ejecute el script de construcción:
   - `build_installer.bat`

5. Si NSIS está instalado, se generará `AlbionMarketInstaller.exe`.
   - El instalador mostrará una pantalla para elegir la carpeta donde instalar la aplicación.
   - Si NSIS no está instalado, el ejecutable se genera en `dist\AlbionMarket\AlbionMarket.exe`.

## Archivos añadidos

- `logo.png`: imagen usada como logo principal.
- `logo.ico`: icono generado desde `logo.png` para el ejecutable e instalador.
- `App.spec`: configurado para crear `AlbionMarket.exe` con icono.
- `build_installer.bat`: script de construcción automatizado.
- `setup_albion_market.nsi`: script NSIS para crear el instalador.
- `frontend/public/favicon.svg`: icono del frontend para el app web.
- `frontend/public/favicon.ico`: favicon generado desde `logo.png`.

## Requisitos

- Python 3.14 o superior
- Node.js/npm para construir el frontend
- NSIS (`makensis`) si desea crear el instalador `.exe`

## Resultado esperado

- Ejecutable: `dist\AlbionMarket\AlbionMarket.exe`
- Instalador: `AlbionMarketInstaller.exe`
