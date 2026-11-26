import { decode } from "jpeg-js";

/** Side length of the square image Shelfie's detector expects. */
export const INPUT_SIZE = 640;
/** Grey used for letterbox padding, matching Ultralytics training. */
const PAD_VALUE = 114 / 255;

export type ModelInput = {
	/** RGB planes (channel, row, column), scaled to 0–1. Length 3 × INPUT_SIZE². */
	data: Float32Array;
	/** Factor the photo was scaled by to fit INPUT_SIZE. */
	scale: number;
	/** Padding added on the left and top, in input pixels. */
	padX: number;
	padY: number;
};

export function base64ToBytes(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/**
 * Fits an RGBA image into an INPUT_SIZE square without distorting it (bilinear resize,
 * centred, grey padding), and lays it out as the model's float tensor. Matches Ultralytics'
 * letterbox so the app sees photos the way the model did in training.
 */
export function letterbox(rgba: Uint8Array, width: number, height: number): ModelInput {
	const scale = Math.min(INPUT_SIZE / width, INPUT_SIZE / height);
	const newWidth = Math.round(width * scale);
	const newHeight = Math.round(height * scale);
	const padX = Math.floor((INPUT_SIZE - newWidth) / 2);
	const padY = Math.floor((INPUT_SIZE - newHeight) / 2);

	const plane = INPUT_SIZE * INPUT_SIZE;
	const data = new Float32Array(3 * plane).fill(PAD_VALUE);
	const ratioX = width / newWidth;
	const ratioY = height / newHeight;

	for (let y = 0; y < newHeight; y++) {
		// Sample at pixel centres, like OpenCV's INTER_LINEAR.
		const sy = Math.min(Math.max((y + 0.5) * ratioY - 0.5, 0), height - 1);
		const y0 = Math.floor(sy);
		const y1 = Math.min(y0 + 1, height - 1);
		const fy = sy - y0;
		for (let x = 0; x < newWidth; x++) {
			const sx = Math.min(Math.max((x + 0.5) * ratioX - 0.5, 0), width - 1);
			const x0 = Math.floor(sx);
			const x1 = Math.min(x0 + 1, width - 1);
			const fx = sx - x0;
			const i00 = (y0 * width + x0) * 4;
			const i01 = (y0 * width + x1) * 4;
			const i10 = (y1 * width + x0) * 4;
			const i11 = (y1 * width + x1) * 4;
			const out = (y + padY) * INPUT_SIZE + (x + padX);
			for (let c = 0; c < 3; c++) {
				const top = rgba[i00 + c] + (rgba[i01 + c] - rgba[i00 + c]) * fx;
				const bottom = rgba[i10 + c] + (rgba[i11 + c] - rgba[i10 + c]) * fx;
				data[c * plane + out] = (top + (bottom - top) * fy) / 255;
			}
		}
	}
	return { data, scale, padX, padY };
}

/** Decodes a JPEG and letterboxes it for the detector. Also returns the photo's size. */
export function jpegToModelInput(jpeg: Uint8Array): ModelInput & { width: number; height: number } {
	const image = decode(jpeg, { useTArray: true, formatAsRGBA: true });
	return { ...letterbox(image.data, image.width, image.height), width: image.width, height: image.height };
}
