import type { Ingredient } from "@/lib/ingredients";

import { type Detection, readDetections, toIngredients } from "./postprocess";
import { INPUT_SIZE, jpegToModelInput } from "./preprocess";

export { type Detection, MIN_CONFIDENCE } from "./postprocess";
export { INPUT_SIZE } from "./preprocess";

/**
 * The slice of an ONNX Runtime InferenceSession the detector needs. Both onnxruntime-node
 * (Mac tests) and onnxruntime-react-native (the app) satisfy it, so the same code runs in both.
 */
export type DetectorRuntime = {
	run(feeds: Record<string, unknown>): Promise<Record<string, { data: unknown }>>;
	/** Builds an input tensor, e.g. (data, dims) => new Tensor("float32", data, dims). */
	makeTensor(data: Float32Array, dims: number[]): unknown;
};

export type DetectionResult = {
	ingredients: Ingredient[];
	detections: Detection[];
};

/** Runs Shelfie's ingredient detector on a JPEG (ideally already resized to about INPUT_SIZE). */
export async function detectInJpeg(runtime: DetectorRuntime, jpeg: Uint8Array): Promise<DetectionResult> {
	const input = jpegToModelInput(jpeg);
	const outputs = await runtime.run({ images: runtime.makeTensor(input.data, [1, 3, INPUT_SIZE, INPUT_SIZE]) });
	const output = outputs.output0?.data;
	if (!(output instanceof Float32Array)) {
		throw new Error("Detector returned an unexpected output.");
	}
	const detections = readDetections(output, input, input);
	return { ingredients: toIngredients(detections), detections };
}
