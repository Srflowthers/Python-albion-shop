from pathlib import Path
from PIL import Image

source = Path('logo.png')
output = Path('logo.ico')

if not source.exists():
    raise FileNotFoundError('No se encontro logo.png en la raiz del proyecto')

img = Image.open(source)
img = img.convert('RGBA')

sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
img.save(output, format='ICO', sizes=sizes)
print(f'Icono generado: {output}')
