"""
Local PPE detection service — runs YOLO-World entirely on this machine, no
external API calls at inference time. Swapped in for Roboflow's hosted API
specifically to remove per-call credit risk and internet dependency during
a live demo: this process, once started and the model weights are cached
locally, never talks to the network again.

YOLO-World is zero-shot / open-vocabulary: instead of fixed trained classes,
it takes text prompts at inference time (set via PPE_CLASSES below) and
detects anything matching those phrases in the image.
"""

import io
import os

from fastapi import FastAPI, File, UploadFile
from PIL import Image
from ultralytics import YOLO

# Small variant — good balance of speed/accuracy for CPU-only laptop
# inference. Downloaded once on first run and cached under ~/.cache; no
# network calls after that.
MODEL_WEIGHTS = os.environ.get("YOLO_WORLD_WEIGHTS", "yolov8s-worldv2.pt")

# The open-vocabulary prompts checked for on every photo. Edit this list to
# tune what counts as "PPE" for your demo without retraining anything.
PPE_CLASSES = [
    "hard hat",
    "safety helmet",
    "safety vest",
    "high visibility vest",
    "safety gloves",
    "safety boots",
]

CONFIDENCE_THRESHOLD = float(os.environ.get("PPE_CONFIDENCE_THRESHOLD", "0.25"))

app = FastAPI(title="ManholeSafe PPE Detection (local)")

model = YOLO(MODEL_WEIGHTS)
model.set_classes(PPE_CLASSES)


@app.get("/health")
def health():
    return {"status": "ok", "classes": PPE_CLASSES}


@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    results = model.predict(image, conf=CONFIDENCE_THRESHOLD, verbose=False)
    result = results[0]

    predictions = []
    for box in result.boxes:
        class_id = int(box.cls[0])
        predictions.append(
            {
                "class": PPE_CLASSES[class_id],
                "confidence": float(box.conf[0]),
            }
        )

    return {
        "ppe_verified": len(predictions) > 0,
        "predictions": predictions,
        "model": MODEL_WEIGHTS,
    }
