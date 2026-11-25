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

6. **Export for phones**: CoreML (`.mlpackage`, iOS) and ONNX (`.onnx`, iOS and Android), written next to the weights:
	```bash
	uv run export_model.py
	```
	`export_model.py` brings its own pinned environment (Python 3.12, PyTorch 2.7, NumPy 1.26), because coremltools
	and onnxruntime don't support the newer versions used for training. Don't "upgrade" those pins without re-testing.

## Ingredients

The 35 classes are listed in [`shelfie_ml/classes.py`](shelfie_ml/classes.py). Only append to that list:
the order defines the class ids the model outputs.

## Known limitations

- Open Images has no boxes for some fridge staples (onion, lettuce, meat, yoghurt, butter), so the model can't detect them yet.
- Training photos are mostly not taken inside fridges, so accuracy on real fridge shots will be lower than the validation score suggests.
- Open Images labels aren't exhaustive. A photo picked for "tomato" may contain unlabelled carrots, which teaches the model to ignore them.

The fix for all three is the same: add real, labelled fridge photos.

`data/`, `runs/`, `weights/` and `.venv/` are git-ignored.
