# /// script
# requires-python = "==3.12.*"
# dependencies = [
# 	"ultralytics==8.4.218",
# 	"torch==2.7.*",
# 	"torchvision==0.22.*",
# 	"coremltools==9.0",
# 	"numpy==1.26.*",
# 	"onnx",
# 	"onnxslim",
# 	"onnxruntime",
# ]
# ///
"""Export a trained Shelfie detector to on-device formats.

Runs in its own pinned environment (Python 3.12, PyTorch 2.7) because coremltools and onnxruntime
don't support the newer versions used for training.

Usage: uv run export_model.py [weights.pt] [--formats coreml onnx] [--imgsz 640]
Exports are written next to the weights file.
"""

import argparse
from pathlib import Path

from ultralytics import YOLO

ML_DIR = Path(__file__).resolve().parent
DEFAULT_WEIGHTS = ML_DIR / "runs" / "ingredients-v2" / "weights" / "best.pt"


def main() -> None:
	parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
	parser.add_argument("weights", nargs="?", type=Path, default=DEFAULT_WEIGHTS)
	parser.add_argument("--formats", nargs="+", default=["coreml", "onnx"], choices=["coreml", "onnx"])
	parser.add_argument("--imgsz", type=int, default=640)
	args = parser.parse_args()

	for export_format in args.formats:
		# CoreML gets non-max suppression built in, so the phone receives final boxes directly.
		path = YOLO(str(args.weights)).export(format=export_format, imgsz=args.imgsz, nms=export_format == "coreml")
		print(f"Exported {export_format}: {path}")


if __name__ == "__main__":
	main()
