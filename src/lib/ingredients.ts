import type { PreparedPhoto } from "@/lib/photo";

export type Ingredient = {
	/** Lower-case ingredient name, matching the detector's class names (e.g. "bell pepper"). */
	name: string;
	/** How many were detected. Manually added ingredients have a count of 1. */
	count: number;
	/** Detector confidence from 0 to 1, or null if the user added it by hand. */
	confidence: number | null;
};

/**
 * True while detectIngredients returns sample data instead of running Shelfie's own model.
 * Flip to false once the on-device detector is wired in.
 */
export const DETECTION_IS_PLACEHOLDER = true;

const SAMPLE_RESULTS: Ingredient[] = [
	{ name: "tomato", count: 3, confidence: 0.91 },
	{ name: "cheese", count: 1, confidence: 0.84 },
	{ name: "milk", count: 1, confidence: 0.78 },
	{ name: "carrot", count: 4, confidence: 0.72 },
	{ name: "bell pepper", count: 2, confidence: 0.55 },
	{ name: "lemon", count: 1, confidence: 0.41 },
];

/**
 * Finds the ingredients in a fridge photo.
 * Placeholder: waits briefly and returns sample results. The trained YOLO model (ml/) replaces this.
 */
export async function detectIngredients(photo: PreparedPhoto): Promise<Ingredient[]> {
	void photo;
	await new Promise((resolve) => setTimeout(resolve, 800));
	return SAMPLE_RESULTS;
}

/** "bell pepper" -> "Bell pepper" */
export function displayName(name: string): string {
	return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Normalises user-typed names so "  Bell Pepper " matches the detector's "bell pepper". */
export function normaliseName(name: string): string {
	return name.trim().replace(/\s+/g, " ").toLowerCase();
}
