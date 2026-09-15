"""Persistent PP-OCRv6 Small prescription worker using JSONL over stdin/stdout."""
from __future__ import annotations

import json
import os
import sys
import traceback
from pathlib import Path

if sys.platform == "win32" and hasattr(os, "add_dll_directory"):
    for candidate in (Path(sys.executable).parent, Path(sys.executable).parent / "Library" / "bin"):
        if candidate.exists():
            os.add_dll_directory(str(candidate))

import cv2
from paddleocr import PaddleOCR

ENGINE = "paddle-ocr-v6"
DETECTOR_MODEL = "PP-OCRv6_small_det"
RECOGNIZER_MODEL = "PP-OCRv6_small_rec"


def emit(message: dict) -> None:
    sys.stdout.write(json.dumps(message, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def log(message: str) -> None:
    print(f"[paddle-ocr] {message}", file=sys.stderr, flush=True)


def preprocess(image):
    """Gentle contrast normalisation; preserve original dimensions for handwriting."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    contrast = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8)).apply(gray)
    return cv2.cvtColor(contrast, cv2.COLOR_GRAY2BGR)


def reading_order_text(lines):
    boxed = [line for line in lines if len(line.get("box", [])) == 4]
    if len(boxed) != len(lines):
        return "\n".join(line["text"] for line in lines)
    heights = sorted(max(1, line["box"][3] - line["box"][1]) for line in boxed)
    tolerance = max(8, heights[len(heights) // 2] * 0.45)
    rows = []
    for line in sorted(boxed, key=lambda item: ((item["box"][1] + item["box"][3]) / 2, item["box"][0])):
        center = (line["box"][1] + line["box"][3]) / 2
        row = next((item for item in rows if abs(item["center"] - center) <= tolerance), None)
        if row is None:
            rows.append({"center": center, "items": [line]})
        else:
            row["items"].append(line)
            row["center"] = sum((item["box"][1] + item["box"][3]) / 2 for item in row["items"]) / len(row["items"])
    rows.sort(key=lambda row: row["center"])
    return "\n".join(" | ".join(item["text"] for item in sorted(row["items"], key=lambda item: item["box"][0])) for row in rows)


log(f"initialising {DETECTOR_MODEL} + {RECOGNIZER_MODEL}")
model = PaddleOCR(
    text_detection_model_name=DETECTOR_MODEL,
    text_recognition_model_name=RECOGNIZER_MODEL,
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    enable_mkldnn=False,
)
emit({"type": "ready", "engine": ENGINE})

for raw_request in sys.stdin:
    request_id = None
    try:
        request = json.loads(raw_request)
        request_id = request["id"]
        file_path = Path(request["filePath"]).resolve(strict=True)
        image = cv2.imread(str(file_path), cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Uploaded file is not a readable JPEG or PNG image.")
        height, width = image.shape[:2]
        if width < 320 or height < 200:
            emit({"id": request_id, "engine": ENGINE, "text": "", "confidence": 0, "lines": [], "warnings": ["Prescription image is not clear enough. Please upload a clearer image."], "quality": {"acceptable": False, "width": width, "height": height}})
            continue
        result = model.predict(preprocess(image))[0].json["res"]
        texts, scores, boxes = result.get("rec_texts", []), result.get("rec_scores", []), result.get("rec_boxes", [])
        lines = [{"text": str(text).strip(), "confidence": float(scores[index]), "box": [int(value) for value in boxes[index]]} for index, text in enumerate(texts) if str(text).strip()]
        confidence = sum(line["confidence"] for line in lines) / len(lines) if lines else 0
        emit({"id": request_id, "engine": ENGINE, "text": reading_order_text(lines), "confidence": confidence, "lines": lines, "warnings": [], "quality": {"acceptable": True, "width": width, "height": height}})
    except Exception as error:
        traceback.print_exc(file=sys.stderr)
        emit({"id": request_id, "error": str(error)})