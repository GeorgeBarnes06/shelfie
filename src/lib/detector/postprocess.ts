import { type Ingredient, INGREDIENT_NAMES } from "@/lib/ingredients";

import type { ModelInput } from "./preprocess";

/** Detections below this confidence are dropped (Ultralytics' default). */
export const MIN_CONFIDENCE = 0.25;
/** Values per detection in the model output: x1, y1, x2, y2, confidence, class id. */
const STRIDE = 6;

export type Detection = {
	name: string;
	confidence: number;
	/** Box in the original photo's pixels. */
	box: { x1: number; y1: number; x2: number; y2: number };
};

/**
 * Reads the detector's output (YOLO26 end-to-end: up to 300 boxes, already de-duplicated,
 * in letterboxed 640×640 coordinates) and maps boxes back onto the original photo.
 */
export function readDetections(
	output: Float32Array,
	input: Pick<ModelInput, "scale" | "padX" | "padY">,
	photo: { width: number; height: number },
	minConfidence = MIN_CONFIDENCE,
): Detection[] {
	const detections: Detection[] = [];
	const clampX = (v: number) => Math.min(Math.max((v - input.padX) / input.scale, 0), photo.width);
	const clampY = (v: number) => Math.min(Math.max((v - input.padY) / input.scale, 0), photo.height);

	for (let i = 0; i + STRIDE <= output.length; i += STRIDE) {
		const confidence = output[i + 4];
		const name = INGREDIENT_NAMES[Math.round(output[i + 5])];
		if (confidence < minConfidence || !name) {
			continue;
		}
		detections.push({
			name,
			confidence,
			box: { x1: clampX(output[i]), y1: clampY(output[i + 1]), x2: clampX(output[i + 2]), y2: clampY(output[i + 3]) },
		});
	}
	return detections.sort((a, b) => b.confidence - a.confidence);
}

/** One entry per ingredient: how many were seen and the most confident sighting. Most confident first. */
export function toIngredients(detections: Detection[]): Ingredient[] {
	const byName = new Map<string, Ingredient>();
	for (const detection of detections) {
		const existing = byName.get(detection.name);
		if (existing) {
			existing.count += 1;
			existing.confidence = Math.max(existing.confidence ?? 0, detection.confidence);
		} else {
			byName.set(detection.name, { name: detection.name, count: 1, confidence: detection.confidence });
		}
	}
	return [...byName.values()].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
}
