"""Run an ingredient detector on photos and print what it finds.

Usage: uv run python -m shelfie_ml.detect path/to/fridge.jpg [more.jpg …] [--weights runs/ingredients-v1/weights/best.pt]
Saves annotated copies to runs/detect/.
"""

import argparse
from collections import Counter
from pathlib import Path

from ultralytics import YOLO

ML_DIR = Path(__file__).resolve().parent.parent
DEFAULT_WEIGHTS = ML_DIR / "runs" / "ingredients-v1" / "weights" / "best.pt"


def main() -> None:
	parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
	parser.add_argument("images", nargs="+", type=Path)
	parser.add_argument("--weights", default=str(DEFAULT_WEIGHTS))
	parser.add_argument("--conf", type=float, default=0.25, help="Minimum confidence to report")
	args = parser.parse_args()

	model = YOLO(args.weights)
	results = model.predict(
		[str(path) for path in args.images],
		conf=args.conf,
		device="mps",
		save=True,
		project=str(ML_DIR / "runs"),
		name="detect",
		exist_ok=True,
		verbose=False,
	)
	for path, result in zip(args.images, results):
		counts = Counter(result.names[int(c)] for c in result.boxes.cls)
		found = ", ".join(f"{name} ×{n}" if n > 1 else name for name, n in counts.most_common()) or "nothing"
		print(f"{path.name}: {found}")
	print(f"Annotated images saved to {results[0].save_dir}")


if __name__ == "__main__":
	main()
