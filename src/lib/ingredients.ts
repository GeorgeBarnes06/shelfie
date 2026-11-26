import type { PreparedPhoto } from "@/lib/photo";

/**
 * Every ingredient Shelfie's detector knows, in its class-id order.
 * Keep in sync with NAMES in ml/shelfie_ml/classes.py (append-only).
 */
export const INGREDIENT_NAMES = [
	"apple", "artichoke", "banana", "beer", "bell pepper", "bread", "broccoli", "cabbage", "cantaloupe",
	"carrot", "cheese", "cucumber", "egg", "asparagus", "grapes", "grapefruit", "juice", "lemon", "mango",
	"milk", "mushroom", "orange", "peach", "pear", "pineapple", "pomegranate", "potato", "pumpkin", "radish",
	"shrimp", "strawberry", "tomato", "watermelon", "wine", "zucchini",
	"beef", "blueberry", "butter", "chicken", "chocolate", "corn", "eggplant", "flour", "cream", "ginger",
	"goat cheese", "chilli", "leafy greens", "green beans", "ground beef", "ham", "lime", "meat", "onion",
	"spinach", "sugar", "sweet potato",
] as const;

export type IngredientName = (typeof INGREDIENT_NAMES)[number];

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

/** Parses a JSON list of ingredient names from a route param, ignoring anything malformed. */
export function parseNameList(raw: string | undefined): string[] {
	if (!raw) {
		return [];
	}
	try {
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === "string") : [];
	} catch {
		return [];
	}
}

/** Common other names (often British) for detector ingredients. */
const ALIASES: Record<string, IngredientName> = {
	aubergine: "eggplant",
	courgette: "zucchini",
	prawn: "shrimp",
	pepper: "bell pepper",
	capsicum: "bell pepper",
	mince: "ground beef",
	"minced beef": "ground beef",
	"beef mince": "ground beef",
	steak: "beef",
	chili: "chilli",
	"chili pepper": "chilli",
	sweetcorn: "corn",
	lettuce: "leafy greens",
	rocket: "leafy greens",
	kale: "leafy greens",
	salad: "leafy greens",
	feta: "cheese",
	cheddar: "cheese",
	mozzarella: "cheese",
	parmesan: "cheese",
	"goat's cheese": "goat cheese",
	"goats cheese": "goat cheese",
	"double cream": "cream",
	"single cream": "cream",
	"orange juice": "juice",
	"apple juice": "juice",
	melon: "cantaloupe",
	grape: "grapes",
	bacon: "ham",
	"green bean": "green beans",
	"sweet potatoes": "sweet potato",
};

const KNOWN = new Set<string>(INGREDIENT_NAMES);

/**
 * Normalises a typed name and maps plurals and other names onto the detector's names,
 * so "Eggs", "prawns" and "courgette" match recipes. Unknown names are returned normalised.
 */
export function canonicalName(raw: string): string {
	const name = normaliseName(raw);
	const singulars = [name, name.replace(/ies$/, "y"), name.replace(/oes$/, "o"), name.replace(/es$/, ""), name.replace(/s$/, "")];
	for (const candidate of singulars) {
		if (KNOWN.has(candidate)) {
			return candidate;
		}
		if (candidate in ALIASES) {
			return ALIASES[candidate];
		}
	}
	return name;
}
