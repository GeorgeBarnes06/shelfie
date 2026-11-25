"""Build the round-2 dataset: Open Images (data/yolo) + FridgeFoodDetection (data/roboflow), on one class list.

Images are symlinked, not copied. Labels are rewritten to Shelfie's class ids, polygon labels are
converted to boxes, and images with no labels are skipped. Writes data/yolo-v2/ with:
	dataset.yaml  train on both sources, validate on both
	fridge.yaml   validate/test on fridge photos only — the score that matters for Shelfie

Usage: uv run python -m shelfie_ml.merge_datasets
"""

import re
import shutil
from collections import Counter
from pathlib import Path

from shelfie_ml.classes import FRIDGE_FOOD, NAMES

ML_DIR = Path(__file__).resolve().parent.parent
OPEN_IMAGES_DIR = ML_DIR / "data" / "yolo"
FRIDGE_DIR = ML_DIR / "data" / "roboflow" / "fridgefooddetection-cxnl3-v1"
OUT_DIR = ML_DIR / "data" / "yolo-v2"


def fridge_class_map() -> dict[int, int]:
	"""Map FridgeFoodDetection class ids to Shelfie class ids using its data.yaml."""
	match = re.search(r"names: \[(.*)\]", (FRIDGE_DIR / "data.yaml").read_text())
	if not match:
		raise SystemExit("Couldn't read class names from FridgeFoodDetection data.yaml")
	source_names = [name.strip().strip("'\"") for name in match.group(1).split(",")]
	unknown = [name for name in source_names if name not in FRIDGE_FOOD]
	if unknown:
		raise SystemExit(f"FridgeFoodDetection classes missing from FRIDGE_FOOD mapping: {unknown}")
	return {index: NAMES.index(FRIDGE_FOOD[name]) for index, name in enumerate(source_names)}


def to_box(values: list[float]) -> tuple[float, float, float, float]:
	"""Return (x centre, y centre, width, height) for a YOLO box or polygon (x1 y1 x2 y2 …)."""
	if len(values) == 4:
		return values[0], values[1], values[2], values[3]
	xs, ys = values[0::2], values[1::2]
	x_min, x_max = max(0.0, min(xs)), min(1.0, max(xs))
	y_min, y_max = max(0.0, min(ys)), min(1.0, max(ys))
	return (x_min + x_max) / 2, (y_min + y_max) / 2, x_max - x_min, y_max - y_min


def add_split(images_dir: Path, labels_dir: Path, out_split: str, prefix: str, class_map: dict[int, int] | None, counts: Counter[int]) -> int:
	out_images = OUT_DIR / "images" / out_split
	out_labels = OUT_DIR / "labels" / out_split
	out_images.mkdir(parents=True, exist_ok=True)
	out_labels.mkdir(parents=True, exist_ok=True)
	added = 0
	for image_path in sorted(images_dir.glob("*.jpg")):
		label_path = labels_dir / f"{image_path.stem}.txt"
		if not label_path.exists():
			continue
		lines = []
		for line in label_path.read_text().splitlines():
			parts = line.split()
			if len(parts) < 5 or len(parts) % 2 == 0:
				continue
			class_id = int(parts[0]) if class_map is None else class_map[int(parts[0])]
			x, y, w, h = to_box([float(v) for v in parts[1:]])
			if w <= 0 or h <= 0:
				continue
			lines.append(f"{class_id} {x:.6f} {y:.6f} {w:.6f} {h:.6f}")
			counts[class_id] += 1
		if not lines:
			# Some FridgeFoodDetection photos have empty label files even though they clearly show food.
			# Training on them would teach the model to ignore that food, so leave them out.
			continue
		name = f"{prefix}_{image_path.stem}"
		(out_images / f"{name}.jpg").symlink_to(image_path.resolve())
		(out_labels / f"{name}.txt").write_text("\n".join(lines) + ("\n" if lines else ""))
		added += 1
	return added


def write_yaml(path: Path, train: str, val: str, test: str | None = None) -> None:
	names = "".join(f"  {index}: {name}\n" for index, name in enumerate(NAMES))
	test_line = f"test: {test}\n" if test else ""
	path.write_text(f"path: {OUT_DIR}\ntrain: {train}\nval: {val}\n{test_line}names:\n{names}")


def main() -> None:
	if not (OPEN_IMAGES_DIR / "images" / "train").exists() or not (FRIDGE_DIR / "train").exists():
		raise SystemExit("Need both data/yolo (prepare_dataset) and data/roboflow/fridgefooddetection-cxnl3-v1 (fetch_roboflow)")
	if OUT_DIR.exists():
		shutil.rmtree(OUT_DIR)
	fridge_map = fridge_class_map()
	counts: Counter[int] = Counter()

	sources = [
		(OPEN_IMAGES_DIR / "images" / "train", OPEN_IMAGES_DIR / "labels" / "train", "train", "oi", None),
		(FRIDGE_DIR / "train" / "images", FRIDGE_DIR / "train" / "labels", "train", "fridge", fridge_map),
		(OPEN_IMAGES_DIR / "images" / "val", OPEN_IMAGES_DIR / "labels" / "val", "val", "oi", None),
		(FRIDGE_DIR / "valid" / "images", FRIDGE_DIR / "valid" / "labels", "val", "fridge", fridge_map),
		(FRIDGE_DIR / "valid" / "images", FRIDGE_DIR / "valid" / "labels", "fridge_val", "fridge", fridge_map),
		(FRIDGE_DIR / "test" / "images", FRIDGE_DIR / "test" / "labels", "fridge_test", "fridge", fridge_map),
	]
	for images_dir, labels_dir, split, prefix, class_map in sources:
		split_counts: Counter[int] = Counter()
		added = add_split(images_dir, labels_dir, split, prefix, class_map, split_counts)
		if split == "train":
			counts.update(split_counts)
		print(f"{split:<12} +{added:>6} {prefix} images, {sum(split_counts.values())} boxes")

	write_yaml(OUT_DIR / "dataset.yaml", "images/train", "images/val")
	write_yaml(OUT_DIR / "fridge.yaml", "images/train", "images/fridge_val", "images/fridge_test")
	print("\nTraining boxes per ingredient (lowest first):")
	print("  " + ", ".join(f"{NAMES[c]}={counts[c]}" for c in sorted(range(len(NAMES)), key=lambda c: counts[c])))
	print(f"\nWrote {OUT_DIR / 'dataset.yaml'} and {OUT_DIR / 'fridge.yaml'}")


if __name__ == "__main__":
	main()
