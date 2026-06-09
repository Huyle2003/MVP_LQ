"""Quick validation test for new schemas."""
import sys
sys.path.insert(0, 'backend')

from app.schemas.compose_schema import SkinBoardComposeRequest

# Test with one item (no editor)
req = SkinBoardComposeRequest(
    compose_type='v2_editor_inside_background',
    background_object='test/bg.png',
    items=[{
        'skin_id': '00000000-0000-0000-0000-000000000001',
        'skin_object_name': 'test/skin.png',
    }],
)
d = req.model_dump()
print('SUCCESS: basic validation passed')
print(f'editor: {d.get("editor")}')
print(f'options keys: {list(d.get("options", {}).keys())}')

# Test with editor having counted_image_layers
from app.schemas.compose_schema import ComposeEditorOptions, EditorCountedImageLayer
editor = ComposeEditorOptions(
    skin_placement='inside_background',
    wr_placement='inside_background',
    counted_image_layers=[
        EditorCountedImageLayer(
            object_name='counted-images/test.png',
            quantity=30,
            x=100, y=100, width=90,
        )
    ],
)
ed = editor.model_dump()
print(f'counted_image_layers: {ed.get("counted_image_layers")}')
print('SUCCESS: counted layers validation passed')
