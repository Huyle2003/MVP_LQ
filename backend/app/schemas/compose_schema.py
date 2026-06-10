from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ─── Old compose (single overlay) ──────────────────────────
class ComposeRequest(BaseModel):
    background_object: str
    overlay_object: str

    x: int = Field(default=50, ge=0)
    y: int = Field(default=50, ge=0)
    width: int = Field(default=300, ge=1)
    opacity: float = Field(default=1.0, ge=0.0, le=1.0)


# ─── Skin board compose (multiple skins with overlays) ─────
class ComposeSkinBoardItem(BaseModel):
    skin_id: UUID
    skin_object_name: str = Field(..., min_length=1)
    use_button: bool = False
    button_object_name: Optional[str] = None
    use_kill_notification: bool = False
    kill_notification_object_name: Optional[str] = None
    compose_mode: str = Field("inside_skin", pattern="^(inside_skin|mode_2)$")
    skin_height: Optional[int] = Field(None, ge=100, le=800)


class ComposeWinRateItem(BaseModel):
    object_name: str = Field(..., min_length=1)


class SkinBoardOptions(BaseModel):
    skin_target_height: int = Field(330, ge=100, le=800)
    skin_gap: int = Field(0, ge=0, le=50)
    skin_margin_top: int = Field(0, ge=0, le=200)
    gap_color: str = Field("#000000")
    background_mode: str = Field("fit_width", pattern="^(fit_width|cover_width|keep)$")
    output_format: str = Field("PNG", pattern="^(PNG|JPEG)$")
    button_position: str = Field("center_pct_75")
    button_width_ratio: float = Field(0.35, ge=0.1, le=1.0)
    kill_notification_position: str = Field("center_pct_50")
    kill_notification_width_ratio: float = Field(1.0, ge=0.1, le=2.0)
    # Win rate options
    win_rate_enabled: bool = False
    win_rate_position: str = Field("below_skin", pattern="^(below_skin|inside_background)$")
    win_rate_target_height: int = Field(330, ge=100, le=800)
    win_rate_gap: int = Field(0, ge=0, le=50)
    section_gap: int = Field(0, ge=0, le=100)
    # V2 inside-background options
    v2_x: int = Field(870, ge=0)
    v2_y: int = Field(930, ge=0)
    v2_skin_height: int = Field(320, ge=100, le=800)
    v2_skin_gap: int = Field(0, ge=0, le=50)
    v2_border_padding: int = Field(4, ge=0, le=50)
    v2_border_size: int = Field(5, ge=0, le=30)
    v2_border_color: str = Field("#ffffff")
    v2_align: str = Field("left", pattern="^(left|center)$")
    v2_max_width: Optional[int] = Field(None, ge=0)
    v2_overflow_mode: str = Field("shrink_to_fit", pattern="^(shrink_to_fit|crop|allow)$")


class EditorSkinRow(BaseModel):
    """Skin row settings in the v2 editor."""
    x: int = Field(0, ge=0)
    y: int = Field(0, ge=0)
    skin_height: int = Field(320, ge=100, le=1000)
    skin_gap: int = Field(0, ge=0, le=80)
    border_size: int = Field(5, ge=0, le=50)
    border_padding: int = Field(4, ge=0, le=80)
    border_color: str = Field("#ffffff")
    scale: float = Field(1.0, ge=0.2, le=5.0)
    z_index: int = Field(5, ge=0)
    align: str = Field("left", pattern="^(left|center)$")
    stretch_fit: bool = False


class EditorExtraImageV2(BaseModel):
    """An extra overlay image from 'Other Images' catalogue."""
    other_image_id: Optional[str] = None
    object_name: str = Field(..., min_length=1)
    x: int = Field(0, ge=0)
    y: int = Field(0, ge=0)
    width: int = Field(180, ge=10, le=3000)
    height: int = Field(0, ge=0, le=3000)
    scale: float = Field(1.0, ge=0.2, le=5.0)
    border_size: int = Field(0, ge=0, le=30)
    border_padding: int = Field(0, ge=0, le=40)
    border_color: str = Field("#ffffff")
    opacity: float = Field(1.0, ge=0.1, le=1.0)
    rotation: float = Field(0.0)
    z_index: int = Field(10, ge=0)


class EditorCountedImageText(BaseModel):
    font_size: int = Field(32, ge=8, le=200)
    font_color: str = Field("#ffffff")
    stroke_color: str = Field("#000000")
    stroke_width: int = Field(2, ge=0, le=20)
    position: str = Field("bottom_right", pattern="^(bottom_right|bottom_left|top_right|top_left|center)$")
    offset_x: int = Field(-4)
    offset_y: int = Field(-4)


class EditorCountedImageLayer(BaseModel):
    counted_image_id: Optional[str] = None
    object_name: str = Field(..., min_length=1)
    quantity: int = Field(..., ge=0)
    x: int = Field(0, ge=0)
    y: int = Field(0, ge=0)
    width: int = Field(90, ge=10, le=1000)
    border_size: int = Field(2, ge=0, le=30)
    border_color: str = Field("#ffffff")
    opacity: float = Field(1.0, ge=0.1, le=1.0)
    z_index: int = Field(20, ge=0)
    text: EditorCountedImageText = Field(default_factory=EditorCountedImageText)


class ComposeEditorOptions(BaseModel):
    """Visual editor state for unified editor."""
    skin_placement: str = Field("inside_background", pattern="^(inside_background|below_background)$")
    wr_placement: str = Field("inside_background", pattern="^(inside_background|below_background)$")
    merged: bool = False
    section_gap: int = Field(0, ge=0, le=200)
    background_color: str = Field("#000000")
    skin_row: EditorSkinRow = Field(default_factory=EditorSkinRow)
    win_rate_row: Optional[EditorSkinRow] = None
    extra_images: list[EditorExtraImageV2] = Field(default_factory=list, max_length=50)
    counted_image_layers: list[EditorCountedImageLayer] = Field(default_factory=list, max_length=50)
    overflow_mode: str = Field("crop", pattern="^(crop|allow)$")


class SkinBoardComposeRequest(BaseModel):
    compose_type: str = Field("v1_below_background", pattern="^(v1_below_background|v2_inside_background|v2_editor_inside_background)$")
    background_object: str = Field(..., min_length=1)
    items: list[ComposeSkinBoardItem] = Field(..., min_length=1, max_length=20)
    win_rate_items: list[ComposeWinRateItem] = Field(default_factory=list, max_length=20)
    options: SkinBoardOptions = Field(default_factory=SkinBoardOptions)
    editor: Optional[ComposeEditorOptions] = None


class ComposeResponse(BaseModel):
    job_id: str
    status: str


class JobResponse(BaseModel):
    job_id: str
    status: str
    result_object: str | None = None
    result_url: str | None = None
    error: str | None = None
