"""Download a public dataset from Roboflow Universe in YOLO format.

Reads ROBOFLOW_API_KEY from ml/.env (git-ignored). The key is never printed.

Usage:
	uv run python -m shelfie_ml.fetch_roboflow --info                      # show licence, classes, versions
	uv run python -m shelfie_ml.fetch_roboflow --version 1                 # download into data/roboflow/
	uv run python -m shelfie_ml.fetch_roboflow --project fridgefooddetection-cxnl3 --info
"""

import argparse
import io
import json
import os
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

ML_DIR = Path(__file__).resolve().parent.parent
OUT_DIR = ML_DIR / "data" / "roboflow"
API = "https://api.roboflow.com"
DEFAULT_WORKSPACE = "objectdetectionlearning-4empo"
DEFAULT_PROJECT = "aicook-lcv4d-zzbgs"


def load_api_key() -> str:
	key = os.environ.get("ROBOFLOW_API_KEY")
	env_file = ML_DIR / ".env"
	if not key and env_file.exists():
		for line in env_file.read_text().splitlines():
			name, _, value = line.partition("=")
			if name.strip() == "ROBOFLOW_API_KEY":
				key = value.strip().strip('"').strip("'")
	if not key:
		raise SystemExit("ROBOFLOW_API_KEY not found. Add it to ml/.env as ROBOFLOW_API_KEY=your_key")
	return key


def get_json(path: str, key: str) -> dict:
	url = f"{API}/{path}?{urllib.parse.urlencode({'api_key': key})}"
	try:
		with urllib.request.urlopen(url, timeout=60) as response:
			return json.load(response)
	except urllib.error.HTTPError as error:
		# Don't echo the URL: it contains the key.
		raise SystemExit(f"Roboflow API error {error.code} for /{path}: {error.read()[:300]!r}") from None


def show_info(workspace: str, project: str, key: str) -> None:
	data = get_json(f"{workspace}/{project}", key)
	info = data.get("project", {})
	print(f"Name:     {info.get('name')}")
	print(f"Licence:  {info.get('license', 'not stated')}")
	print(f"Images:   {info.get('images')}")
	classes = info.get("classes") or {}
	print(f"Classes ({len(classes)}): {', '.join(sorted(classes))}")
	print("Versions:")
	for version in data.get("versions", []):
		print(f"  {version.get('id', '').rsplit('/', 1)[-1]:>3}  {version.get('name', '')}  images={version.get('images')}")


def safe_extract(archive: zipfile.ZipFile, destination: Path) -> None:
	"""Extract a downloaded zip, refusing entries that would land outside destination."""
	root = destination.resolve()
	for member in archive.infolist():
		target = (destination / member.filename).resolve()
		if not target.is_relative_to(root):
			raise SystemExit(f"Refusing unsafe path in archive: {member.filename}")
	archive.extractall(destination)


def download(workspace: str, project: str, version: int, key: str) -> Path:
	export = get_json(f"{workspace}/{project}/{version}/yolov8", key).get("export", {})
	link = export.get("link")
	if not link:
		raise SystemExit("Roboflow didn't return a download link yet (export may still be generating). Try again in a minute.")
	destination = OUT_DIR / f"{project}-v{version}"
	destination.mkdir(parents=True, exist_ok=True)
	print(f"Downloading {project} v{version}…")
	with urllib.request.urlopen(link, timeout=300) as response:
		safe_extract(zipfile.ZipFile(io.BytesIO(response.read())), destination)
	return destination


def main() -> None:
	parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
	parser.add_argument("--workspace", default=DEFAULT_WORKSPACE)
	parser.add_argument("--project", default=DEFAULT_PROJECT)
	parser.add_argument("--version", type=int)
	parser.add_argument("--info", action="store_true")
	args = parser.parse_args()

	key = load_api_key()
	if args.info or args.version is None:
		show_info(args.workspace, args.project, key)
	if args.version is not None:
		print(f"Saved to {download(args.workspace, args.project, args.version, key)}")


if __name__ == "__main__":
	main()
