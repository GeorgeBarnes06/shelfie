"""Download real-world fridge photos the model has never seen, for testing.

Picks Open Images validation/test photos that contain a Refrigerator box and are not
already in data/yolo (so neither training nor checkpoint selection saw them).
Photos showing more of the ingredients we detect are picked first.

Open Images photos are CC BY 2.0 (see README for attribution).

Usage:
	uv run python -m shelfie_ml.fetch_fridge_photos --count 40
"""

import argparse
import csv
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from shelfie_ml.classes import OPEN_IMAGES
from shelfie_ml.prepare_dataset import download_image

ML_DIR = Path(__file__).resolve().parent.parent
OI_DIR = ML_DIR / "data" / "openimages"
FRIDGE_ID = "/m/040b_t"


def label_ids() -> dict[str, str]:
	"""Map Open Images label id -> display name, for the classes we detect."""
	ids = {}
	with open(OI_DIR / "oidv7-class-descriptions-boxable.csv", newline="") as f:
		for label_id, display in csv.reader(f):
			if display in OPEN_IMAGES:
				ids[label_id] = OPEN_IMAGES[display]
	return ids


def main() -> None:
	parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
	parser.add_argument("--count", type=int, default=40)
	parser.add_argument("--out", type=Path, default=ML_DIR / "data" / "fridge-photos")
	args = parser.parse_args()

	food = label_ids()
	seen = {p.stem for p in (ML_DIR / "data" / "yolo").glob("images/*/*.jpg")}

	fridges: dict[str, str] = {}  # image id -> OI split
	foods: dict[str, set[str]] = defaultdict(set)
	for split in ("validation", "test"):
		with open(OI_DIR / f"{split}-annotations-bbox.csv", newline="") as f:
			for row in csv.DictReader(f):
				image_id, label = row["ImageID"], row["LabelName"]
				if image_id in seen or row["IsDepiction"] == "1":
					continue
				if label == FRIDGE_ID:
					fridges[image_id] = split
				elif label in food:
					foods[image_id].add(food[label])

	ranked = sorted(fridges, key=lambda i: (-len(foods[i]), i))[: args.count]
	args.out.mkdir(parents=True, exist_ok=True)

	def fetch(image_id: str) -> bool:
		return download_image(fridges[image_id], image_id, args.out / f"fridge-{image_id}.jpg")

	with ThreadPoolExecutor(8) as pool:
		ok = sum(pool.map(fetch, ranked))

	with open(args.out / "labels.csv", "w", newline="") as f:
		writer = csv.writer(f)
		writer.writerow(["image", "labelled_ingredients"])
		for image_id in ranked:
			writer.writerow([f"fridge-{image_id}.jpg", "; ".join(sorted(foods[image_id]))])

	with_food = sum(1 for i in ranked if foods[i])
	print(f"{len(fridges)} unseen fridge photos available; downloaded {ok}/{len(ranked)} to {args.out}")
	print(f"{with_food} have ingredient labels (listed in labels.csv)")


if __name__ == "__main__":
	main()
