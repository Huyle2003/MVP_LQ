import json
import threading
import time
import traceback
from datetime import datetime, timezone, timedelta
from uuid import uuid4

from app.core.redis_client import get_redis_client
from app.domain.job_status import JobStatus
from app.repositories.storage_repository import StorageRepository
from app.tasks.image_composer import compose_images
from app.tasks.skin_board_composer import (
    ComposeOptions,
    SkinComposeItem,
    compose_skin_board,
    compose_skin_board_v2,
)
from app.tasks.skin_board_editor_composer import (
    EditorComposeItem,
    EditorExtraImageData,
    EditorRenderOptions,
    EditorSkinRowData,
    compose_skin_board_editor_v2,
)

QUEUE_KEY = "image_jobs"


def update_job(redis_client, job_id: str, **kwargs):
    key = f"job:{job_id}"
    raw = redis_client.get(key)
    if not raw:
        return
    data = json.loads(raw)
    data.update(kwargs)
    redis_client.set(key, json.dumps(data))


def process_simple_compose(job: dict, storage: StorageRepository) -> bytes:
    """Process old-style single overlay compose."""
    background_bytes = storage.read_bytes(job["background_object"])
    overlay_bytes = storage.read_bytes(job["overlay_object"])

    return compose_images(
        background_bytes=background_bytes,
        overlay_bytes=overlay_bytes,
        x=int(job.get("x", 50)),
        y=int(job.get("y", 50)),
        width=int(job.get("width", 300)),
        opacity=float(job.get("opacity", 1.0)),
    )


def process_skin_board_compose(job: dict, storage: StorageRepository) -> bytes:
    """Process skin-board compose: background + skins + optional win rate images."""
    opts = job.get("options", {})
    items_data = job.get("items", [])
    if not items_data:
        raise ValueError("items is empty")

    background_bytes = storage.read_bytes(job["background_object"])

    skin_items: list[SkinComposeItem] = []
    for item_data in items_data:
        skin_bytes = storage.read_bytes(item_data["skin_object_name"])
        btn_bytes = storage.read_bytes(item_data["button_object_name"]) if item_data.get("use_button") and item_data.get("button_object_name") else None
        ntf_bytes = storage.read_bytes(item_data["kill_notification_object_name"]) if item_data.get("use_kill_notification") and item_data.get("kill_notification_object_name") else None

        skin_items.append(SkinComposeItem(
            skin_bytes=skin_bytes,
            use_button=item_data.get("use_button", False),
            button_bytes=btn_bytes,
            use_kill_notification=item_data.get("use_kill_notification", False),
            kill_notification_bytes=ntf_bytes,
            compose_mode=item_data.get("compose_mode", "inside_skin"),
            button_position=opts.get("button_position", "center_pct_75"),
            button_width_ratio=opts.get("button_width_ratio", 0.35),
            kill_notification_position=opts.get("kill_notification_position", "center_pct_50"),
            kill_notification_width_ratio=opts.get("kill_notification_width_ratio", 1.0),
        ))

    # Load win rate images
    wr_images_bytes = []
    if opts.get("win_rate_enabled"):
        wr_data = job.get("win_rate_items", [])
        for wr_item in wr_data:
            wr_bytes = storage.read_bytes(wr_item["object_name"])
            wr_images_bytes.append(wr_bytes)

    compose_opts = ComposeOptions(
        skin_target_height=opts.get("skin_target_height", 330),
        skin_gap=opts.get("skin_gap", 0),
        skin_margin_top=opts.get("skin_margin_top", 0),
        gap_color=opts.get("gap_color", "#000000"),
        background_mode=opts.get("background_mode", "fit_width"),
        output_format=opts.get("output_format", "PNG"),
        win_rate_enabled=opts.get("win_rate_enabled", False),
        win_rate_position=opts.get("win_rate_position", "below_skin"),
        win_rate_target_height=opts.get("win_rate_target_height", 330),
        win_rate_gap=opts.get("win_rate_gap", 0),
        section_gap=opts.get("section_gap", 0),
    )

    return compose_skin_board(
        background_bytes=background_bytes,
        skin_items=skin_items,
        win_rate_images_bytes=wr_images_bytes if wr_images_bytes else None,
        opts=compose_opts,
    )


def process_skin_board_compose_v2(job: dict, storage: StorageRepository) -> bytes:
    """V2 compose: skins pasted *inside* background image."""
    opts = job.get("options", {})
    items_data = job.get("items", [])
    if not items_data:
        raise ValueError("items is empty")

    background_bytes = storage.read_bytes(job["background_object"])

    skin_items: list[SkinComposeItem] = []
    for item_data in items_data:
        skin_bytes = storage.read_bytes(item_data["skin_object_name"])
        btn_bytes = storage.read_bytes(item_data["button_object_name"]) if item_data.get("use_button") and item_data.get("button_object_name") else None
        ntf_bytes = storage.read_bytes(item_data["kill_notification_object_name"]) if item_data.get("use_kill_notification") and item_data.get("kill_notification_object_name") else None

        skin_items.append(SkinComposeItem(
            skin_bytes=skin_bytes,
            use_button=item_data.get("use_button", False),
            button_bytes=btn_bytes,
            use_kill_notification=item_data.get("use_kill_notification", False),
            kill_notification_bytes=ntf_bytes,
            compose_mode=item_data.get("compose_mode", "inside_skin"),
            button_position=opts.get("button_position", "center_pct_75"),
            button_width_ratio=opts.get("button_width_ratio", 0.35),
            kill_notification_position=opts.get("kill_notification_position", "center_pct_50"),
            kill_notification_width_ratio=opts.get("kill_notification_width_ratio", 1.0),
            skin_height=item_data.get("skin_height"),
        ))

    compose_opts = ComposeOptions(
        v2_x=opts.get("v2_x", 870),
        v2_y=opts.get("v2_y", 930),
        v2_skin_height=opts.get("v2_skin_height", 320),
        v2_skin_gap=opts.get("v2_skin_gap", 0),
        v2_border_padding=opts.get("v2_border_padding", 4),
        v2_border_size=opts.get("v2_border_size", 5),
        v2_border_color=opts.get("v2_border_color", "#ffffff"),
        v2_align=opts.get("v2_align", "left"),
        v2_max_width=opts.get("v2_max_width"),
        v2_overflow_mode=opts.get("v2_overflow_mode", "shrink_to_fit"),
    )

    return compose_skin_board_v2(background_bytes, skin_items, compose_opts)


def process_skin_board_editor_v2(job: dict, storage: StorageRepository) -> bytes:
    """Process editor v2 compose: skins pasted at precise coordinates from drag-drop editor."""
    editor_data = job.get("editor", {})
    if not editor_data:
        raise ValueError("editor options missing")

    items_data = job.get("items", [])
    if not items_data:
        raise ValueError("items is empty")

    background_bytes = storage.read_bytes(job["background_object"])

    print(f"[debug] process_skin_board_editor_v2: {len(items_data)} items, editor_keys={list(editor_data.keys())}, wr_placement={editor_data.get('wr_placement')}, skin_placement={editor_data.get('skin_placement')}, merged={editor_data.get('merged')}")
    editor_items: list[EditorComposeItem] = []
    for item_data in items_data:
        print(f"[debug] loading skin: {item_data['skin_object_name'][:60]}")
        skin_bytes = storage.read_bytes(item_data["skin_object_name"])
        btn_bytes = storage.read_bytes(item_data["button_object_name"]) if item_data.get("use_button") and item_data.get("button_object_name") else None
        ntf_bytes = storage.read_bytes(item_data["kill_notification_object_name"]) if item_data.get("use_kill_notification") and item_data.get("kill_notification_object_name") else None

        editor_items.append(EditorComposeItem(
            skin_bytes=skin_bytes,
            use_button=item_data.get("use_button", False),
            button_bytes=btn_bytes,
            use_kill_notification=item_data.get("use_kill_notification", False),
            kill_notification_bytes=ntf_bytes,
            compose_mode=item_data.get("compose_mode", "inside_skin"),
            button_position=editor_data.get("button_position", "center_pct_75"),
            button_width_ratio=editor_data.get("button_width_ratio", 0.35),
            kill_notification_position=editor_data.get("kill_notification_position", "center_pct_50"),
            kill_notification_width_ratio=editor_data.get("kill_notification_width_ratio", 1.0),
        ))

    # Load extra images from catalogue
    extra_list = editor_data.get("extra_images", []) or []
    extra_images = []
    for ext in extra_list:
        ext_bytes = storage.read_bytes(ext["object_name"])
        extra_images.append(EditorExtraImageData(
            image_bytes=ext_bytes,
            x=ext.get("x", 0),
            y=ext.get("y", 0),
            width=ext.get("width", 180),
            height=ext.get("height", 0),
            scale=ext.get("scale", 1.0),
            border_size=ext.get("border_size", 0),
            border_padding=ext.get("border_padding", 0),
            border_color=ext.get("border_color", "#ffffff"),
            opacity=ext.get("opacity", 1.0),
            rotation=ext.get("rotation", 0.0),
            z_index=ext.get("z_index", 10),
        ))

    # Load counted image layers
    from app.tasks.skin_board_editor_composer import EditorCountedImageLayerData, EditorCountedImageTextData
    counted_list = editor_data.get("counted_image_layers", []) or []
    counted_image_layers = []
    for ci in counted_list:
        ci_bytes = storage.read_bytes(ci["object_name"])
        text_data = ci.get("text", {})
        counted_image_layers.append(EditorCountedImageLayerData(
            image_bytes=ci_bytes,
            counted_image_id=ci.get("counted_image_id"),
            quantity=ci.get("quantity", 0),
            x=ci.get("x", 0),
            y=ci.get("y", 0),
            width=ci.get("width", 90),
            opacity=ci.get("opacity", 1.0),
            z_index=ci.get("z_index", 20),
            text=EditorCountedImageTextData(
                font_size=text_data.get("font_size", 32),
                font_color=text_data.get("font_color", "#ffffff"),
                stroke_color=text_data.get("stroke_color", "#000000"),
                stroke_width=text_data.get("stroke_width", 2),
                position=text_data.get("position", "bottom_right"),
                offset_x=text_data.get("offset_x", -4),
                offset_y=text_data.get("offset_y", -4),
            ),
        ))

    sr_data = editor_data.get("skin_row", {})
    skin_row = EditorSkinRowData(
        skin_bytes_list=[],
        x=sr_data.get("x", 0),
        y=sr_data.get("y", 0),
        skin_height=sr_data.get("skin_height", 320),
        skin_gap=sr_data.get("skin_gap", 0),
        border_size=sr_data.get("border_size", 5),
        border_padding=sr_data.get("border_padding", 4),
        border_color=sr_data.get("border_color", "#ffffff"),
        scale=sr_data.get("scale", 1.0),
        z_index=sr_data.get("z_index", 5),
        align=sr_data.get("align", "left"),
        stretch_fit=sr_data.get("stretch_fit", False),
    )

    # Load win_rate_items for WR row
    wr_item_list = job.get("win_rate_items", []) or []
    wr_item_bytes = []
    for wr_it in wr_item_list:
        wr_bytes = storage.read_bytes(wr_it["object_name"])
        wr_item_bytes.append(wr_bytes)

    wr_row_data = editor_data.get("win_rate_row")
    win_rate_row_obj = None
    if wr_row_data and wr_item_bytes:
        win_rate_row_obj = EditorSkinRowData(
            x=wr_row_data.get("x", 0), y=wr_row_data.get("y", 0),
            skin_height=wr_row_data.get("skin_height", 200),
            skin_gap=wr_row_data.get("skin_gap", 0),
            border_size=wr_row_data.get("border_size", 0),
            border_padding=wr_row_data.get("border_padding", 0),
            border_color=wr_row_data.get("border_color", "#ffffff"),
            scale=wr_row_data.get("scale", 1.0),
            z_index=wr_row_data.get("z_index", 6),
            align=wr_row_data.get("align", "left"),
            stretch_fit=wr_row_data.get("stretch_fit", False),
            skin_bytes_list=wr_item_bytes,
        )

    editor_opts = EditorRenderOptions(
        skin_placement=editor_data.get("skin_placement", "inside_background"),
        wr_placement=editor_data.get("wr_placement", "inside_background"),
        merged=editor_data.get("merged", False),
        section_gap=editor_data.get("section_gap", 0),
        background_color=editor_data.get("background_color", "#000000"),
        skin_row=skin_row,
        win_rate_row=win_rate_row_obj,
        extra_images=extra_images,
        counted_image_layers=counted_image_layers,
        overflow_mode=editor_data.get("overflow_mode", "crop"),
    )

    return compose_skin_board_editor_v2(background_bytes, editor_items, editor_opts)


def process_job(job_id: str):
    redis_client = get_redis_client()
    storage = StorageRepository()

    raw = redis_client.get(f"job:{job_id}")
    if not raw:
        return

    job = json.loads(raw)
    update_job(redis_client, job_id, status=JobStatus.PROCESSING)

    try:
        job_type = job.get("type", "SIMPLE_COMPOSE")

        if job_type == "SKIN_BOARD_COMPOSE":
            compose_type = job.get("compose_type", "v1_below_background")

            if compose_type == "v2_editor_inside_background":
                result_bytes = process_skin_board_editor_v2(job, storage)
                result_object = f"results/skin-board-editor-v2/{uuid4()}.png"
                storage.save_bytes_to_path(
                    content=result_bytes,
                    object_name=result_object,
                    content_type="image/png",
                )
            elif compose_type == "v2_inside_background":
                result_bytes = process_skin_board_compose_v2(job, storage)
                result_object = f"results/skin-board-v2/{uuid4()}.png"
                storage.save_bytes_to_path(
                    content=result_bytes,
                    object_name=result_object,
                    content_type="image/png",
                )
            else:
                result_bytes = process_skin_board_compose(job, storage)
                result_object = f"results/skin-board/{uuid4()}.png"
                storage.save_bytes_to_path(
                    content=result_bytes,
                    object_name=result_object,
                    content_type="image/png",
                )
        else:
            result_bytes = process_simple_compose(job, storage)
            result_object = storage.save_result_bytes(result_bytes)

        update_job(
            redis_client,
            job_id,
            status=JobStatus.COMPLETED,
            result_object=result_object,
            error=None,
        )
        print(f"[worker] completed job {job_id} (type={job_type})", flush=True)

    except Exception as exc:
        update_job(
            redis_client,
            job_id,
            status=JobStatus.FAILED,
            error=str(exc),
        )
        print(f"[worker] failed job {job_id}: {exc}", flush=True)
        traceback.print_exc()


RESULT_TTL_HOURS = 1
CLEANUP_INTERVAL = 300  # every 5 minutes


def cleanup_old_results():
    """Delete result images older than RESULT_TTL_HOURS from MinIO."""
    try:
        storage = StorageRepository()
        prefixes = [
            "results/skin-board-editor-v2/",
            "results/skin-board-v2/",
            "results/skin-board/",
        ]
        cutoff = datetime.now(timezone.utc) - timedelta(hours=RESULT_TTL_HOURS)
        deleted = 0
        for prefix in prefixes:
            objects = storage.list_objects(prefix=prefix)
            for obj in objects:
                lm = obj["last_modified"]
                if lm.tzinfo is None:
                    lm = lm.replace(tzinfo=timezone.utc)
                if lm < cutoff:
                    storage.delete_object(obj["object_name"])
                    deleted += 1
        if deleted:
            print(f"[cleanup] deleted {deleted} expired result images", flush=True)
    except Exception as exc:
        print(f"[cleanup] error: {exc}", flush=True)


def cleanup_loop():
    while True:
        time.sleep(CLEANUP_INTERVAL)
        cleanup_old_results()


def main():
    redis_client = get_redis_client()

    # Start cleanup thread
    cleanup_thread = threading.Thread(target=cleanup_loop, daemon=True)
    cleanup_thread.start()

    print("[worker] started. waiting for jobs...", flush=True)

    while True:
        item = redis_client.blpop(QUEUE_KEY, timeout=5)
        if not item:
            continue

        _, job_id = item
        print(f"[worker] received job {job_id}", flush=True)
        process_job(job_id)


if __name__ == "__main__":
    main()
