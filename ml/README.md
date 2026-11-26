# Shelfie ingredient detector

Trains Shelfie's own object-detection model to find ingredients in fridge photos.
It fine-tunes a small pretrained [YOLO](https://docs.ultralytics.com) model on food images from
[Open Images V7](https://storage.googleapis.com/openimages/web/index.html).

## Setup

Needs [uv](https://docs.astral.sh/uv/) (`brew install uv`). The first `uv run` creates `.venv/` with Python 3.12, PyTorch and Ultralytics.

## Pipeline

1. **Download annotations** (about 2.4GB) into `data/openimages/`:
	```bash
	mkdir -p data/openimages && cd data/openimages
	curl -O https://storage.googleapis.com/openimages/v7/oidv7-class-descriptions-boxable.csv
	curl -o train-annotations-bbox.csv https://storage.googleapis.com/openimages/v6/oidv6-train-annotations-bbox.csv
	curl -O https://storage.googleapis.com/openimages/v5/validation-annotations-bbox.csv
	curl -O https://storage.googleapis.com/openimages/v5/test-annotations-bbox.csv
	```
2. **Build the dataset**: picks a balanced set of images per ingredient, downloads them (shrunk to 640px) and writes YOLO labels to `data/yolo/`:
	```bash
	uv run python -m shelfie_ml.prepare_dataset
	```
3. **Check the dataset**: per-ingredient counts, malformed labels, and `data/yolo/preview.jpg` with boxes drawn on random photos:
	```bash
	uv run python -m shelfie_ml.check_dataset
	```
4. **Train** on the Mac's GPU (MPS). Results, charts and weights go to `runs/ingredients-v1/`:
	```bash
	uv run python -m shelfie_ml.train
	```
5. **Try it** on any photo. Annotated copies are saved to `runs/detect/`:
	```bash
	uv run python -m shelfie_ml.detect path/to/fridge.jpg
	```
	For unseen real-world fridge photos (Open Images val/test, not in `data/yolo`), download some to `data/fridge-photos/`:
	```bash
	uv run python -m shelfie_ml.fetch_fridge_photos --count 40
	uv run python -m shelfie_ml.detect data/fridge-photos/*.jpg
	```

6. **Export for phones**: CoreML (`.mlpackage`, iOS) and ONNX (`.onnx`, iOS and Android), written next to the weights:
	```bash
	uv run export_model.py runs/ingredients-v2/weights/best.pt
	```
	`export_model.py` brings its own pinned environment (Python 3.12, PyTorch 2.7, NumPy 1.26), because coremltools
	and onnxruntime don't support the newer versions used for training. Don't "upgrade" those pins without re-testing.

## Round 2: real fridge photos

Round 1 trains on Open Images only. Round 2 adds [FridgeFoodDetection](https://universe.roboflow.com/objectdetectionlearning-4empo/fridgefooddetection-cxnl3)
(real fridge photos). Rather than fine-tuning round 1, train once from the pretrained model on the merged set
(about 23 min/epoch on an M4 MacBook Air; quit other apps first, as memory pressure makes it ~3x slower):

```bash
# Needs ROBOFLOW_API_KEY in ml/.env (git-ignored; free Roboflow account)
uv run python -m shelfie_ml.fetch_roboflow --project fridgefooddetection-cxnl3 --version 1
uv run python -m shelfie_ml.merge_datasets          # builds data/yolo-v2/
uv run python -m shelfie_ml.check_dataset --dataset data/yolo-v2
caffeinate -is uv run python -u -m shelfie_ml.train --data data/yolo-v2/dataset.yaml --name ingredients-v2 > data/train-v2.log 2>&1
```

`data/yolo-v2/fridge.yaml` validates and tests on fridge photos only. That's the score that matters for Shelfie:

```bash
uv run yolo val model=runs/ingredients-v2/weights/best.pt data=data/yolo-v2/fridge.yaml split=test
```

## Ingredients

The 57 classes and each dataset's label mapping are in [`shelfie_ml/classes.py`](shelfie_ml/classes.py).
Only append to `NAMES`: the order defines the class ids the model outputs.

## Data sources and licences

Shipping a model trained on these means crediting them (e.g. on an in-app credits/licences screen):

- **Open Images V7** (Google): annotations CC BY 4.0; images are individually licensed, mostly CC BY 2.0.
- **FridgeFoodDetection** by Karel Cornelis et al. (Erasmus Brussels), via Roboflow Universe: MIT License.

## Known limitations

- Some staples are still missing (lettuce, yoghurt). Round 2 adds onion, butter, meat and others from FridgeFoodDetection.
- Round 1's photos are mostly not taken inside fridges. Round 2 fixes that.
- A few ingredients have very few fridge examples (cucumber, ginger, chilli, eggplant, cabbage, bell pepper).
- FridgeFoodDetection has ~1,300 photos with empty label files. `merge_datasets` skips them.
- Open Images labels aren't exhaustive. A photo picked for "tomato" may contain unlabelled carrots, which teaches the model to ignore them.

The fix for all three is the same: add real, labelled fridge photos.

`data/`, `runs/`, `weights/` and `.venv/` are git-ignored.
