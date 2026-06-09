"""Check a specific job from Redis by reading directly."""
import json
import redis

r = redis.Redis(host='redis', port=6379, db=0)
keys = r.keys('job:*')
# Get the last 3 jobs
for key in sorted(keys)[-3:]:
    raw = r.get(key)
    d = json.loads(raw)
    print(f"Job: {d['job_id']}")
    print(f"  status: {d.get('status')}")
    print(f"  items: {len(d.get('items', []))}")
    ed = d.get('editor', {})
    print(f"  editor.skin_placement: {ed.get('skin_placement')}")
    sr = ed.get('skin_row', {})
    print(f"  editor.skin_row: x={sr.get('x')}, y={sr.get('y')}, h={sr.get('skin_height')}, stretch={sr.get('stretch_fit')}")
    print(f"  editor.extra_images: {len(ed.get('extra_images', []))}")
    print(f"  editor.counted_layers: {len(ed.get('counted_image_layers', []))}")
    print(f"  win_rate_items: {len(d.get('win_rate_items', []))}")
    for i, it in enumerate(d.get('items', [])):
        sn = it.get('skin_object_name', 'MISSING')
        print(f"    item[{i}]: object_name={sn[:60]}")
    print()
