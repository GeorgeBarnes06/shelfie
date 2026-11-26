"""Build data/yolo-v3: data/yolo-v2 plus "nothing to find" background photos.

Round 2 only ever saw photos that contained food, so on real photos it called closed
white fridges "milk" and red fridges "juice". Background photos (with empty label files)
teach it that fridges, kitchens and appliances on their own are not ingredients.

Backgrounds are Open Images photos containing kitchen things (fridges first) where no
food, drink or container is labelled. They go to data/backgrounds/, and dataset.yaml
lists both sources, so nothing in yolo-v2 is copied.

Open Images labels are not exhaustive: about 1 in 5 candidates still shows unlabelled
food (a full fridge, chicken on a grill). Training on those would teach the model to
ignore food, so the round-2 model screens every candidate and any photo where it finds
a normal-sized ingredient is dropped. Photos where it only finds one huge box (a whole
fridge called "milk") are kept: those are the mistakes backgrounds are meant to fix.

Usage:
	uv run python -m shelfie_ml.add_backgrounds --train 2000 --val 200
"""

import argparse
import csv
import random
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from ultralytics import YOLO

from shelfie_ml.classes import NAMES, OPEN_IMAGES
from shelfie_ml.prepare_dataset import download_image

ML_DIR = Path(__file__).resolve().parent.parent
DATA = ML_DIR / "data"
OI_DIR = DATA / "openimages"
OUT = DATA / "backgrounds"
SCREEN_WEIGHTS = ML_DIR / "runs" / "ingredients-v2" / "weights" / "best.pt"
SCREEN_CONF = 0.2  # a detection this confident...
SCREEN_MAX_AREA = 0.25  # ...covering less than this share of the photo means "has food"
OVERSAMPLE = 1.6  # download this many times the target, since screening drops some

# Photos must contain at least one of these. Refrigerator is ranked first.
SCENE = [
	"Refrigerator", "Kitchen appliance", "Home appliance", "Oven", "Gas stove", "Microwave oven",
	"Dishwasher", "Sink", "Countertop", "Cabinetry", "Kitchen & dining room table",
]
# Photos with any of these (or any ingredient we detect) are skipped: they may hold food.
FOODISH = {
	"Baked goods", "Bottle", "Bowl", "Box", "Coffee cup", "Container", "Cooking spray", "Dairy Product",
	"Dessert", "Drink", "Fast food", "Food", "Fruit", "Jug", "Mixing bowl", "Mug", "Pasta", "Pizza",
	"Plastic bag", "Plate", "Salad", "Seafood", "Serving tray", "Snack", "Tin can", "Vegetable",
	"Wine glass", "Tableware",
}


def label_ids(names: set[str]) -> dict[str, str]:
	with open(OI_DIR / "oidv7-class-descriptions-boxable.csv", newline="") as f:
		return {label_id: display for label_id, display in csv.reader(f) if display in names}


def candidates(splits: list[str], skip: set[str]) -> dict[str, tuple[str, int]]:
	"""Image id -> (OI split, scene rank) for photos with a kitchen thing and no food."""
	scene = label_ids(set(SCENE))
	foodish = set(label_ids(FOODISH | set(OPEN_IMAGES)))
	rank: dict[str, tuple[str, int]] = {}
	excluded: set[str] = set(skip)
	for split in splits:
		print(f"reading {split} annotations...", flush=True)
		with open(OI_DIR / f"{split}-annotations-bbox.csv", newline="") as f:
			reader = csv.reader(f)
			header = next(reader)
			image_col, label_col, depiction_col = (header.index(c) for c in ("ImageID", "LabelName", "IsDepiction"))
			for row in reader:
				image_id, label = row[image_col], row[label_col]
				if label in foodish or row[depiction_col] == "1":
					excluded.add(image_id)
				elif label in scene:
					r = SCENE.index(scene[label])
					if image_id not in rank or r < rank[image_id][1]:
						rank[image_id] = (split, r)
	return {i: v for i, v in rank.items() if i not in excluded}


def pick(pool: dict[str, tuple[str, int]], count: int, seed: int) -> list[str]:
	ids = sorted(pool)
	random.Random(seed).shuffle(ids)
	return sorted(ids, key=lambda i: pool[i][1])[:count]  # stable sort keeps shuffle within each rank


def has_food(model: YOLO, path: Path) -> bool:
	result = model.predict(path, conf=SCREEN_CONF, device="mps", verbose=False)[0]
	return any(float(area) < SCREEN_MAX_AREA for area in result.boxes.xywhn[:, 2] * result.boxes.xywhn[:, 3])


def download(name: str, pool: dict[str, tuple[str, int]], ids: list[str], count: int, model: YOLO) -> int:
	"""Download candidates in rank order, screen out photos with food, keep the first `count`."""
	images, labels = OUT / "images" / name, OUT / "labels" / name
	images.mkdir(parents=True, exist_ok=True)
	labels.mkdir(parents=True, exist_ok=True)

	def fetch(image_id: str) -> Path | None:
		path = images / f"bg_{image_id}.jpg"
		return path if download_image(pool[image_id][0], image_id, path) else None

	with ThreadPoolExecutor(16) as executor:
		paths = [p for p in executor.map(fetch, ids) if p]

	kept, dropped = [], 0
	for path in paths:
		if len(kept) < count and not has_food(model, path):
			kept.append(path)
			(labels / f"{path.stem}.txt").touch()
		else:
			dropped += path not in kept
			path.unlink()
			(labels / f"{path.stem}.txt").unlink(missing_ok=True)
	print(f"{name}: kept {len(kept)} backgrounds, removed {dropped} (food found or surplus)", flush=True)
	return len(kept)


def write_yaml() -> Path:
	out = DATA / "yolo-v3"
	out.mkdir(exist_ok=True)
	lines = [
		f"path: {DATA}",
		"train:",
		"  - yolo-v2/images/train",
		"  - backgrounds/images/train",
		"val:",
		"  - yolo-v2/images/val",
		"  - backgrounds/images/val",
		"names:",
		*(f"  {i}: {name}" for i, name in enumerate(NAMES)),
	]
	path = out / "dataset.yaml"
	path.write_text("\n".join(lines) + "\n")
	return path


def main() -> None:
	parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
	parser.add_argument("--train", type=int, default=2000)
	parser.add_argument("--val", type=int, default=200)
	parser.add_argument("--seed", type=int, default=0)
	args = parser.parse_args()

	# Never use photos already in a dataset or in the real-world test set.
	skip = {p.stem.removeprefix("oi_") for p in (DATA / "yolo-v2" / "images").glob("*/*.jpg")}
	skip |= {p.stem.removeprefix("fridge-") for p in (DATA / "fridge-photos").glob("*.jpg")}

	train_pool = candidates(["train"], skip)
	val_pool = candidates(["validation", "test"], skip)
	print(f"candidates: {len(train_pool)} train, {len(val_pool)} val", flush=True)

	model = YOLO(str(SCREEN_WEIGHTS))
	download("train", train_pool, pick(train_pool, int(args.train * OVERSAMPLE), args.seed), args.train, model)
	download("val", val_pool, pick(val_pool, int(args.val * OVERSAMPLE), args.seed), args.val, model)
	print(f"wrote {write_yaml()}")


if __name__ == "__main__":
	main()
