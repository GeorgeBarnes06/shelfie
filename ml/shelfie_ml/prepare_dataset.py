"""Build a YOLO-format ingredient dataset from Open Images V7 bounding boxes.

Reads the Open Images box annotation CSVs in data/openimages/, picks a balanced subset of
images for each ingredient class, downloads and shrinks those images, and writes YOLO labels.

Usage: uv run python -m shelfie_ml.prepare_dataset [--train-per-class 500] [--val-per-class 80]
"""

import argparse
import csv
import io
import random
import time
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image

from shelfie_ml.classes import NAMES, OPEN_IMAGES

ML_DIR = Path(__file__).resolve().parent.parent
OI_DIR = ML_DIR / "data" / "openimages"
OUT_DIR = ML_DIR / "data" / "yolo"
IMAGE_URL = "https://open-images-dataset.s3.amazonaws.com/{split}/{image_id}.jpg"
MAX_SIDE = 640
SEED = 42

Box = tuple[int, float, float, float, float]  # class id, x centre, y centre, width, height (normalised)


def load_label_ids() -> dict[str, int]:
	"""Map Open Images label ids (e.g. /m/014j1m) to our YOLO class ids."""
	wanted = {oi_name: NAMES.index(name) for oi_name, name in OPEN_IMAGES.items()}
	label_ids: dict[str, int] = {}
	found: set[str] = set()
	with open(OI_DIR / "oidv7-class-descriptions-boxable.csv", newline="") as file:
		for label_id, display_name in csv.reader(file):
			if display_name in wanted:
				label_ids[label_id] = wanted[display_name]
				found.add(display_name)
	missing = set(wanted) - found
	if missing:
		raise SystemExit(f"Classes not found in Open Images: {sorted(missing)}")
	return label_ids


def read_boxes(csv_names: list[str], label_ids: dict[str, int]) -> dict[str, list[Box]]:
	"""Collect our classes' boxes per image. Images containing drawings/depictions are dropped."""
	boxes: dict[str, list[Box]] = defaultdict(list)
	depictions: set[str] = set()
	for csv_name in csv_names:
		print(f"Reading {csv_name}…", flush=True)
		with open(OI_DIR / csv_name, newline="") as file:
			for row in csv.DictReader(file):
				class_id = label_ids.get(row["LabelName"])
				if class_id is None:
					continue
				if row["IsDepiction"] == "1":
					depictions.add(row["ImageID"])
					continue
				x_min, x_max = float(row["XMin"]), float(row["XMax"])
				y_min, y_max = float(row["YMin"]), float(row["YMax"])
				boxes[row["ImageID"]].append(
					(class_id, (x_min + x_max) / 2, (y_min + y_max) / 2, x_max - x_min, y_max - y_min)
				)
	for image_id in depictions:
		boxes.pop(image_id, None)
	return boxes


def select_images(boxes: dict[str, list[Box]], per_class: int) -> list[str]:
	"""Pick up to per_class images for each class, filling the rarest classes first."""
	images_by_class: dict[int, list[str]] = defaultdict(list)
	for image_id, image_boxes in boxes.items():
		for class_id in {box[0] for box in image_boxes}:
			images_by_class[class_id].append(image_id)

	rng = random.Random(SEED)
	selected: set[str] = set()
	counts: dict[int, int] = defaultdict(int)
	for class_id in sorted(images_by_class, key=lambda c: len(images_by_class[c])):
		candidates = sorted(images_by_class[class_id])
		rng.shuffle(candidates)
		for image_id in candidates:
			if counts[class_id] >= per_class:
				break
			if image_id not in selected:
				selected.add(image_id)
				for other in {box[0] for box in boxes[image_id]}:
					counts[other] += 1
	for class_id, name in enumerate(NAMES):
		if name in OPEN_IMAGES.values():
			print(f"  {name:<12} {counts[class_id]:>5} images (of {len(images_by_class[class_id])} available)")
	return sorted(selected)


def download_image(oi_split: str, image_id: str, destination: Path) -> bool:
	if destination.exists():
		return True
	url = IMAGE_URL.format(split=oi_split, image_id=image_id)
	for attempt in range(3):
		try:
			with urllib.request.urlopen(url, timeout=30) as response:
				image = Image.open(io.BytesIO(response.read())).convert("RGB")
			image.thumbnail((MAX_SIDE, MAX_SIDE))
			image.save(destination, "JPEG", quality=90)
			return True
		except Exception as error:  # noqa: BLE001 — network and decode errors are both retryable
			if attempt == 2:
				print(f"  failed {image_id}: {error}", flush=True)
			time.sleep(1 + attempt)
	return False


def write_split(name: str, sources: dict[str, str], boxes: dict[str, list[Box]], image_ids: list[str], workers: int) -> None:
	"""Download images and write YOLO labels for one split. sources maps image id -> Open Images split."""
	image_dir = OUT_DIR / "images" / name
	label_dir = OUT_DIR / "labels" / name
	image_dir.mkdir(parents=True, exist_ok=True)
	label_dir.mkdir(parents=True, exist_ok=True)

	print(f"Downloading {len(image_ids)} {name} images…", flush=True)
	done = failed = 0
	with ThreadPoolExecutor(max_workers=workers) as pool:
		futures = {
			pool.submit(download_image, sources[image_id], image_id, image_dir / f"{image_id}.jpg"): image_id
			for image_id in image_ids
		}
		for future in as_completed(futures):
			image_id = futures[future]
			if future.result():
				lines = [f"{c} {x:.6f} {y:.6f} {w:.6f} {h:.6f}" for c, x, y, w, h in boxes[image_id]]
				(label_dir / f"{image_id}.txt").write_text("\n".join(lines) + "\n")
			else:
				failed += 1
			done += 1
			if done % 500 == 0:
				print(f"  {done}/{len(image_ids)}", flush=True)
	print(f"  {name}: {done - failed} images ready, {failed} failed", flush=True)


def write_dataset_yaml() -> Path:
	path = OUT_DIR / "dataset.yaml"
	names = "\n".join(f"  {index}: {name}" for index, name in enumerate(NAMES))
	path.write_text(f"path: {OUT_DIR}\ntrain: images/train\nval: images/val\nnames:\n{names}\n")
	return path


def main() -> None:
	parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
	parser.add_argument("--train-per-class", type=int, default=500)
	parser.add_argument("--val-per-class", type=int, default=80)
	parser.add_argument("--workers", type=int, default=32)
	args = parser.parse_args()

	label_ids = load_label_ids()

	train_boxes = read_boxes(["train-annotations-bbox.csv"], label_ids)
	print("Train selection:")
	train_ids = select_images(train_boxes, args.train_per_class)

	# Open Images' validation and test splits are both held out from training, so use them together for val.
	val_boxes: dict[str, list[Box]] = {}
	val_sources: dict[str, str] = {}
	for oi_split in ("validation", "test"):
		split_boxes = read_boxes([f"{oi_split}-annotations-bbox.csv"], label_ids)
		val_boxes.update(split_boxes)
		val_sources.update(dict.fromkeys(split_boxes, oi_split))
	print("Val selection:")
	val_ids = select_images(val_boxes, args.val_per_class)

	write_split("train", dict.fromkeys(train_ids, "train"), train_boxes, train_ids, args.workers)
	write_split("val", val_sources, val_boxes, val_ids, args.workers)
	print(f"Wrote {write_dataset_yaml()}")


if __name__ == "__main__":
	main()
