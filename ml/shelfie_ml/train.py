"""Fine-tune a pretrained YOLO detector on the Shelfie ingredient dataset.

Usage: uv run python -m shelfie_ml.train [--epochs 40] [--model yolo26n.pt] [--name ingredients-v1]
"""

import argparse
from pathlib import Path

from ultralytics import YOLO

ML_DIR = Path(__file__).resolve().parent.parent


def main() -> None:
	parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
	parser.add_argument("--model", default="yolo26n.pt", help="Pretrained weights to start from")
	parser.add_argument("--epochs", type=int, default=40)
	parser.add_argument("--imgsz", type=int, default=640)
	parser.add_argument("--batch", type=int, default=16)
	parser.add_argument("--name", default="ingredients-v1")
	parser.add_argument("--fraction", type=float, default=1.0, help="Use only this fraction of training images (for quick tests)")
	args = parser.parse_args()

	model = YOLO(str(ML_DIR / "weights" / args.model) if (ML_DIR / "weights" / args.model).exists() else args.model)
	model.train(
		data=str(ML_DIR / "data" / "yolo" / "dataset.yaml"),
		epochs=args.epochs,
		imgsz=args.imgsz,
		batch=args.batch,
		fraction=args.fraction,
		device="mps",
		workers=4,
		project=str(ML_DIR / "runs"),
		name=args.name,
		exist_ok=True,
		patience=10,
		plots=True,
	)


if __name__ == "__main__":
	main()
