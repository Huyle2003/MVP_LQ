"""Check job data in Redis."""
import json
import sys
import os

# Read from redis_job.txt if exists
if os.path.exists('/app/redis_job.txt'):
    raw = open('/app/redis_job.txt').read()
else:
    raw = sys.stdin.read()

d = json.loads(raw)
print(f"items count: {len(d.get('items', []))}")
print(f"editor.skin_placement: {d.get('editor', {}).get('skin_placement')}")
print(f"editor.skin_row: {d.get('editor', {}).get('skin_row')}")
print(f"editor.extra_images count: {len(d.get('editor', {}).get('extra_images', []))}")
print(f"editor.counted_image_layers count: {len(d.get('editor', {}).get('counted_image_layers', []))}")
print(f"win_rate_items count: {len(d.get('win_rate_items', []))}")
print(f"options keys: {list(d.get('options', {}).keys())}")
for i, it in enumerate(d.get('items', [])):
    sn = it.get('skin_object_name', 'MISSING')
    print(f"  item[{i}]: skin_object_name={sn[:60]}")
