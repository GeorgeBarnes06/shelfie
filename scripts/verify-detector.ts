/// <reference types="node" />
/**
 * Runs the app's detector code (src/lib/detector) on the Mac with onnxruntime-node, so
 * preprocessing and output parsing can be checked without a phone.
 *
 * Usage:
 *   npx tsx scripts/verify-detector.ts <model.onnx> <folder of .jpg> [reference.json]
 *
 * reference.json (optional) maps file name -> [[name, confidence, [x1, y1, x2, y2]], ...],
 * e.g. from Ultralytics predicting with the same ONNX model, and is compared box by box.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { InferenceSession, Tensor } from "onnxruntime-node";

import { type Detection, type DetectorRuntime, detectInJpeg } from "@/lib/detector";

type Reference = Record<string, [string, number, [number, number, number, number]][]>;

function iou(a: Detection["box"], b: [number, number, number, number]): number {
	const w = Math.max(0, Math.min(a.x2, b[2]) - Math.max(a.x1, b[0]));
	const h = Math.max(0, Math.min(a.y2, b[3]) - Math.max(a.y1, b[1]));
	const inter = w * h;
	const union = (a.x2 - a.x1) * (a.y2 - a.y1) + (b[2] - b[0]) * (b[3] - b[1]) - inter;
	return union > 0 ? inter / union : 0;
}

async function main() {
	const [modelPath, folder, referencePath] = process.argv.slice(2);
	if (!modelPath || !folder) {
		throw new Error("Usage: npx tsx scripts/verify-detector.ts <model.onnx> <folder> [reference.json]");
	}
	const session = await InferenceSession.create(modelPath);
	const runtime: DetectorRuntime = {
		run: (feeds) => session.run(feeds as InferenceSession.FeedsType),
		makeTensor: (data, dims) => new Tensor("float32", data, dims),
	};
	const reference: Reference | undefined = referencePath ? JSON.parse(readFileSync(referencePath, "utf8")) : undefined;

	let matched = 0;
	let expected = 0;
	let extra = 0;
	for (const file of readdirSync(folder).filter((f) => f.endsWith(".jpg")).sort()) {
		const started = performance.now();
		const { ingredients, detections } = await detectInJpeg(runtime, new Uint8Array(readFileSync(join(folder, file))));
		const ms = `${(performance.now() - started).toFixed(0)}ms`;

		const found = ingredients.map((i) => `${i.name}${i.count > 1 ? ` ×${i.count}` : ""}`);
		let note = "";
		if (reference) {
			const want = reference[file] ?? [];
			const unused = [...detections];
			for (const [name, , box] of want) {
				const index = unused.findIndex((d) => d.name === name && iou(d.box, box) > 0.9);
				if (index >= 0) {
					matched++;
					unused.splice(index, 1);
				}
			}
			expected += want.length;
			extra += unused.length;
			note = want.length || unused.length ? ` (reference ${want.length}, extra ${unused.length})` : "";
		}
		console.log(`${file}: ${found.join(", ") || "nothing"}  [${ms}]${note}`);
	}
	if (reference) {
		console.log(`\nMatched ${matched}/${expected} reference detections (IoU > 0.9); ${extra} extra.`);
	}
}

main().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
