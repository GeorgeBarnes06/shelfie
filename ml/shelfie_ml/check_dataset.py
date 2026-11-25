"""Sanity-check the YOLO dataset before training.

Counts images and boxes per ingredient, flags malformed labels, and draws boxes on a grid of
random training images (data/yolo/preview.jpg) so you can eyeball that labels line up.

Usage: uv run python -m shelfie_ml.check_dataset [--grid 4]
"""

import argparse
import random
from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw

from shelfie_ml.classes import NAMES

YOLO_DIR = Path(__file__).resolve().parent.parent / "data" / "yolo"
TILE = 320


def read_labels(label_path: Path) -> list[tuple[int, float, float, float, float]]:
	boxes = []
	for line in label_path.read_text().splitlines():
		parts = line.split()
		class_id, x, y, w, h = int(parts[0]), *map(float, parts[1:])
		boxes.append((class_id, x, y, w, h))
	return boxes


def check_split(split: str) -> list[Path]:
	images = sorted((YOLO_DIR / "images" / split).glob("*.jpg"))
	images_per_class: Counter[int] = Counter()
	boxes_per_class: Counter[int] = Counter()
	problems: list[str] = []
	for image_path in images:
		label_path = YOLO_DIR / "labels" / split / f"{image_path.stem}.txt"
		if not label_path.exists():
			problems.append(f"missing label: {label_path.name}")
			continue
		boxes = read_labels(label_path)
		for class_id, x, y, w, h in boxes:
			if not 0 <= class_id < len(NAMES):
				problems.append(f"{label_path.name}: bad class {class_id}")
			if not all(0 <= v <= 1 for v in (x, y, w, h)) or w <= 0 or h <= 0:
				problems.append(f"{label_path.name}: box out of range {x, y, w, h}")
			boxes_per_class[class_id] += 1
		for class_id in {box[0] for box in boxes}:
			images_per_class[class_id] += 1

	print(f"\n{split}: {len(images)} images, {sum(boxes_per_class.values())} boxes, {len(problems)} problems")
	for message in problems[:10]:
		print(f"  ! {message}")
	for class_id, name in enumerate(NAMES):
		print(f"  {name:<12} {images_per_class[class_id]:>5} images {boxes_per_class[class_id]:>6} boxes")
	return images


def draw_preview(images: list[Path], grid: int) -> Path:
	sample = random.Random(0).sample(images, min(grid * grid, len(images)))
	sheet = Image.new("RGB", (grid * TILE, grid * TILE), "black")
	for index, image_path in enumerate(sample):
		image = Image.open(image_path).convert("RGB")
		draw = ImageDraw.Draw(image)
		for class_id, x, y, w, h in read_labels(YOLO_DIR / "labels" / "train" / f"{image_path.stem}.txt"):
			left, top = (x - w / 2) * image.width, (y - h / 2) * image.height
			right, bottom = (x + w / 2) * image.width, (y + h / 2) * image.height
			draw.rectangle((left, top, right, bottom), outline="lime", width=3)
			draw.text((left + 4, top + 2), NAMES[class_id], fill="lime")
		image.thumbnail((TILE, TILE))
		sheet.paste(image, ((index % grid) * TILE, (index // grid) * TILE))
	path = YOLO_DIR / "preview.jpg"
	sheet.save(path, quality=85)
	return path


def main() -> None:
	parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
	parser.add_argument("--grid", type=int, default=4)
	args = parser.parse_args()
	train_images = check_split("train")
	check_split("val")
	print(f"\nPreview: {draw_preview(train_images, args.grid)}")


if __name__ == "__main__":
	main()
