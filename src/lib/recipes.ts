import { type Recipe, RECIPES } from "@/lib/recipe-data";

export type { Recipe, RecipeIngredient } from "@/lib/recipe-data";

/**
 * Things you have that can stand in for what a recipe asks for, keyed by the recipe's ingredient.
 * The detector's "meat" class is vague, so it counts for any meat.
 */
const STANDS_IN_FOR: Record<string, string[]> = {
	beef: ["meat"],
	chicken: ["meat"],
	"ground beef": ["meat"],
	ham: ["meat"],
	cheese: ["goat cheese"],
	"goat cheese": ["cheese"],
	spinach: ["leafy greens"],
	"leafy greens": ["spinach"],
	lemon: ["lime"],
	lime: ["lemon"],
};

export type RecipeMatch = {
	recipe: Recipe;
	/** Required ingredients you have. Maps the recipe's name to what you have (often the same). */
	have: Map<string, string>;
	/** Optional ingredients you have. */
	extras: Map<string, string>;
	/** Required ingredients you don't have. */
	missing: string[];
};

function findInFridge(name: string, fridge: Set<string>): string | undefined {
	if (fridge.has(name)) {
		return name;
	}
	return STANDS_IN_FOR[name]?.find((alternative) => fridge.has(alternative));
}

export function matchRecipe(recipe: Recipe, fridge: Set<string>): RecipeMatch {
	const have = new Map<string, string>();
	const extras = new Map<string, string>();
	const missing: string[] = [];
	for (const ingredient of recipe.ingredients) {
		const found = findInFridge(ingredient.name, fridge);
		if (found) {
			(ingredient.optional ? extras : have).set(ingredient.name, found);
		} else if (!ingredient.optional) {
			missing.push(ingredient.name);
		}
	}
	return { recipe, have, extras, missing };
}

/**
 * Recipes missing at most this many required ingredients are suggested, and only when
 * you already have at least as many as are missing (so one carrot doesn't suggest a stew).
 */
export const MAX_MISSING = 2;

/**
 * Recipes that use what's in the fridge, best first: fewest missing ingredients,
 * then most of your ingredients used, then quickest.
 */
export function suggestRecipes(fridgeNames: string[]): RecipeMatch[] {
	const fridge = new Set(fridgeNames);
	return RECIPES.map((recipe) => matchRecipe(recipe, fridge))
		.filter((match) => match.have.size > 0 && match.missing.length <= MAX_MISSING && match.have.size >= match.missing.length)
		.sort(
			(a, b) =>
				a.missing.length - b.missing.length ||
				b.have.size + b.extras.size - (a.have.size + a.extras.size) ||
				a.recipe.minutes - b.recipe.minutes,
		);
}

export function getRecipe(id: string): Recipe | undefined {
	return RECIPES.find((recipe) => recipe.id === id);
}

/** 75 -> "1 hr 15 min" */
export function formatMinutes(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	if (hours === 0) {
		return `${rest} min`;
	}
	return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}
