# PPE detection service (local)

Runs YOLO-World locally so PPE detection has no per-call cost and no
internet dependency at demo time. The Node backend calls this over
`localhost` only.

## First-time setup

```
cd ppe-service
python -m venv venv
venv\Scripts\pip install -r requirements.txt
```

The first time the service starts, `ultralytics` downloads the YOLO-World
small weights (`yolov8s-worldv2.pt`, a few hundred MB) and caches them
locally. That's the only network call this service ever makes — do this
once, well before the demo, on a working connection.

## Running

```
cd ppe-service
venv\Scripts\uvicorn main:app --port 8000
```

Leave this running alongside the Node backend and Vite frontend. The
backend's `PPE_SERVICE_URL` in `backend/.env` defaults to
`http://localhost:8000` and doesn't need to change unless you run this on a
different port.

Check it's up: `http://localhost:8000/health` should return the list of PPE
classes being detected.

## Before the demo

Run once ahead of time to confirm the model weights are already cached
(`GET /health` responding immediately, not downloading anything), so the
demo doesn't depend on network access at all.
