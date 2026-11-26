import { Asset } from "expo-asset";
import { NativeModules } from "react-native";

import type { DetectorRuntime } from "./index";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro needs a static require to bundle the model.
const MODEL = require("../../../assets/models/ingredients.onnx") as number;

/**
 * True when ONNX Runtime's native module is in this build (a development or production
 * build). Expo Go doesn't include it, so the app falls back to sample results there.
 */
export const DETECTOR_AVAILABLE = NativeModules.Onnxruntime != null;

let runtime: Promise<DetectorRuntime> | undefined;

async function createRuntime(): Promise<DetectorRuntime> {
	// Imported lazily: the package calls its native module as soon as it loads, which would crash Expo Go.
	const { InferenceSession, Tensor } = await import("onnxruntime-react-native");
	const [asset] = await Asset.loadAsync(MODEL);
	if (!asset.localUri) {
		throw new Error("The ingredient model could not be loaded.");
	}
	const session = await InferenceSession.create(asset.localUri);
	return {
		run: (feeds) => session.run(feeds as Parameters<typeof session.run>[0]),
		makeTensor: (data, dims) => new Tensor("float32", data, dims),
	};
}

/** Loads the detector once (about 10 MB) and reuses it. Throws if it isn't in this build. */
export function getDetectorRuntime(): Promise<DetectorRuntime> {
	if (!DETECTOR_AVAILABLE) {
		return Promise.reject(new Error("The ingredient detector isn't available in Expo Go."));
	}
	runtime ??= createRuntime().catch((error: unknown) => {
		runtime = undefined; // allow a retry
		throw error;
	});
	return runtime;
}
