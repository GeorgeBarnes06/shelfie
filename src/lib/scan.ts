import { detectInJpeg } from "@/lib/detector";
import { base64ToBytes } from "@/lib/detector/preprocess";
import { DETECTOR_AVAILABLE, getDetectorRuntime } from "@/lib/detector/native";
import type { Ingredient } from "@/lib/ingredients";
import type { PreparedPhoto } from "@/lib/photo";

export type ScanResult = {
	ingredients: Ingredient[];
	/** True when these are sample results because the detector isn't in this build (Expo Go). */
	isSample: boolean;
};

const SAMPLE_RESULTS: Ingredient[] = [
	{ name: "tomato", count: 3, confidence: 0.91 },
	{ name: "cheese", count: 1, confidence: 0.84 },
	{ name: "milk", count: 1, confidence: 0.78 },
	{ name: "carrot", count: 4, confidence: 0.72 },
	{ name: "bell pepper", count: 2, confidence: 0.55 },
	{ name: "lemon", count: 1, confidence: 0.41 },
];

/**
 * Finds the ingredients in a fridge photo with Shelfie's own detector, running on the phone.
 * In Expo Go (no ONNX Runtime) it returns sample results instead, flagged with isSample.
 */
export async function detectIngredients(photo: PreparedPhoto): Promise<ScanResult> {
	if (!DETECTOR_AVAILABLE) {
		await new Promise((resolve) => setTimeout(resolve, 800));
		return { ingredients: SAMPLE_RESULTS, isSample: true };
	}
	const runtime = await getDetectorRuntime();
	const { ingredients } = await detectInJpeg(runtime, base64ToBytes(photo.base64));
	return { ingredients, isSample: false };
}
