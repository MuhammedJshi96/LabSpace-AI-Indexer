"""Offline catalog QA: GLB material inventory and readable same-model contact sheets."""
from pathlib import Path
import argparse
import json
import struct
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]


def glb_json(path):
    data = path.read_bytes()
    length, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4E4F534A
    return json.loads(data[20:20 + length])


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--models', default='public/models/hero')
    p.add_argument('--renders', default='public/models/hero/renders')
    p.add_argument('--output', default='artifacts/catalog-audit/before')
    p.add_argument('--view', default='isometric')
    a = p.parse_args()
    out = ROOT / a.output
    out.mkdir(parents=True, exist_ok=True)
    models = sorted((ROOT / a.models).glob('*.glb'))
    records = []
    font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 16)
    small = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 12)
    for page in range((len(models) + 11) // 12):
        board = Image.new('RGB', (1440, 1050), '#edf2f1')
        draw = ImageDraw.Draw(board)
        for i, path in enumerate(models[page * 12:page * 12 + 12]):
            x, y = (i % 4) * 360, (i // 4) * 350
            draw.rounded_rectangle((x + 6, y + 6, x + 354, y + 344), 9, fill='white')
            img_path = ROOT / a.renders / f'{path.stem}-{a.view}.png'
            if not img_path.exists():
                raise FileNotFoundError(img_path)
            with Image.open(img_path) as src:
                src = src.convert('RGBA')
                src.thumbnail((342, 285), Image.Resampling.LANCZOS)
                board.paste(src, (x + (360-src.width)//2, y+12+(285-src.height)//2), src)
            draw.text((x + 16, y + 298), path.stem, fill='#172522', font=font)
            doc = glb_json(path)
            moving = [n.get('extras', {}).get('storageMechanism') for n in doc.get('nodes', [])]
            draw.text((x + 16, y + 322), f'{len(doc.get("meshes", []))} mesh batches / {sum(bool(m) for m in moving)} moving assemblies', fill='#61736e', font=small)
            records.append({'id': path.stem, 'bytes': path.stat().st_size,
                'materials': doc.get('materials', []), 'nodes': doc.get('nodes', [])})
        board.save(out / f'{a.view}-{page+1:02d}.jpg', quality=95)
    (out / 'catalog.json').write_text(json.dumps(records, indent=2), encoding='utf-8')
    print(f'Audited {len(records)} models; {(len(models)+11)//12} contact sheets in {out}')


if __name__ == '__main__':
    main()
