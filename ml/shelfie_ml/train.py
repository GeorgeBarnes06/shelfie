"""Fine-tune a pretrained YOLO detector on the Shelfie ingredient dataset.

Usage: uv run python -m shelfie_ml.train [--epochs 30] [--model yolo26n.pt] [--data data/yolo/dataset.yaml] [--name ingredients-v1]

Round 2 (merged Open Images + fridge photos, from the pretrained model):
	uv run python -m shelfie_ml.train --data data/yolo-v2/dataset.yaml --name ingredients-v2

Resume an interrupted run:
	uv run python -m shelfie_ml.train --name ingredients-v2 --resume
"""

import argparse
from pathlib import Path

from ultralytics import YOLO

ML_DIR = Path(__file__).resolve().parent.parent


def main() -> None:
	parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
	parser.add_argument("--model", default="yolo26n.pt", help="Weights to start from: a name in weights/, or a path relative to ml/")
	parser.add_argument("--data", default="data/yolo/dataset.yaml", help="Dataset YAML, relative to ml/")
	parser.add_argument("--epochs", type=int, default=30)
	parser.add_argument("--imgsz", type=int, default=640)
	parser.add_argument("--batch", type=int, default=16)
	parser.add_argument("--name", default="ingredients-v1")
	parser.add_argument("--fraction", type=float, default=1.0, help="Use only this fraction of training images (for quick tests)")
	parser.add_argument("--resume", action="store_true", help="Continue the interrupted run called --name from its last.pt")
	args = parser.parse_args()

	if args.resume:
		YOLO(str(ML_DIR / "runs" / args.name / "weights" / "last.pt")).train(resume=True)
		return

	candidates = [ML_DIR / "weights" / args.model, ML_DIR / args.model]
	model = YOLO(str(next((path for path in candidates if path.exists()), args.model)))
	model.train(
		data=str(ML_DIR / args.data),
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
