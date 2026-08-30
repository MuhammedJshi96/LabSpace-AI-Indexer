"""Rebuild only storage-bearing furniture, with the original material recipes."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import lab_furniture as furniture
import lab_storage_batch4 as storage
import lab_casework_batch3 as casework
import lab_reference_storage_batch5 as reference
import lab_catalog_completion_batch12 as completion
from storage_anatomy import SUPPORTED

output=Path('public/models/hero').resolve()
selected=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else SUPPORTED
for asset_id in sorted(selected):
    module=next(m for m in [completion, storage, reference, casework, furniture] if asset_id in m.ASSETS)
    print('STORAGE_BUILD_START',asset_id,flush=True)
    if module is completion:
        module.build_one(module.ASSETS[asset_id],output,None)
    else:
        module.build_one(module.ASSETS[asset_id],output,None,None)
    print('STORAGE_BUILD_OK',asset_id,flush=True)
