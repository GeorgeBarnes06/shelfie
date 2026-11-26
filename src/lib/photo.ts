import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/** Longest edge, in pixels: the detector's input size, so it never decodes more pixels than it uses. */
const MAX_DIMENSION = 640;
/** High quality: heavy JPEG artefacts make small items harder to recognise. */
const JPEG_QUALITY = 0.9;

export type PhotoSource = {
	uri: string;
	width: number;
	height: number;
};

export type PreparedPhoto = {
	uri: string;
	base64: string;
	width: number;
	height: number;
};

/**
 * Shrinks a fridge photo to the detector's input size so it is quick to decode and analyse.
 * Keeps the aspect ratio and never upscales.
 */
export async function prepareFridgePhoto(photo: PhotoSource): Promise<PreparedPhoto> {
	const context = ImageManipulator.manipulate(photo.uri);

	if (Math.max(photo.width, photo.height) > MAX_DIMENSION) {
		context.resize(photo.width >= photo.height ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION });
	}

	const image = await context.renderAsync();
	try {
		const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY, base64: true });
		if (!result.base64) {
			throw new Error("Image manipulator did not return base64 data.");
		}
		return { uri: result.uri, base64: result.base64, width: result.width, height: result.height };
	} finally {
		image.release();
		context.release();
	}
}

/** Approximate decoded size of a base64 string, in kilobytes. */
export function base64SizeKb(base64: string): number {
	return Math.round((base64.length * 3) / 4 / 1024);
}
