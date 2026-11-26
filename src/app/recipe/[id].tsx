import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { displayName, parseNameList } from "@/lib/ingredients";
import { formatMinutes, getRecipe, matchRecipe, type RecipeIngredient, type RecipeMatch } from "@/lib/recipes";

function IngredientRow({ ingredient, match }: { ingredient: RecipeIngredient; match: RecipeMatch }) {
	const found = match.have.get(ingredient.name) ?? match.extras.get(ingredient.name);
	const substitute = found && found !== ingredient.name ? found : undefined;

	let mark = "·";
	let markClass = "text-gray-500";
	let note: string | undefined;
	if (found) {
		mark = "✓";
		markClass = "text-emerald-400";
		note = substitute ? `Using your ${substitute}` : undefined;
	} else if (ingredient.optional) {
		note = "Optional";
	} else {
		mark = "!";
		markClass = "text-amber-300";
		note = "You need this";
	}

	return (
		<View className="flex-row gap-3 py-2">
			<Text className={`w-4 text-center text-base font-bold ${markClass}`}>{mark}</Text>
			<View className="flex-1">
				<Text className="text-base text-white">
					{displayName(ingredient.name)}
					<Text className="text-gray-400"> · {ingredient.amount}</Text>
				</Text>
				{note && (
					<Text className={`mt-0.5 text-xs ${found ? "text-emerald-400" : ingredient.optional ? "text-gray-500" : "text-amber-300"}`}>
						{note}
					</Text>
				)}
			</View>
		</View>
	);
}

export default function RecipeDetail() {
	const params = useLocalSearchParams<{ id: string; fridge?: string }>();
	const recipe = getRecipe(params.id);
	const match = useMemo(
		() => (recipe ? matchRecipe(recipe, new Set(parseNameList(params.fridge))) : undefined),
		[recipe, params.fridge],
	);

	if (!recipe || !match) {
		return (
			<View className="flex-1 items-center justify-center bg-gray-900 px-6">
				<Text className="text-base text-gray-400">{"We couldn't find that recipe."}</Text>
				<View className="mt-6 w-full">
					<Button label="Back" variant="secondary" onPress={() => router.back()} />
				</View>
			</View>
		);
	}

	return (
		<View className="flex-1 bg-gray-900 pt-safe">
			<ScrollView contentContainerClassName="px-6 pb-safe">
				<Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8} className="mt-2 self-start py-2">
					<Text className="text-base text-emerald-400">‹ Recipes</Text>
				</Pressable>

				<Text className="mt-2 text-3xl font-bold text-white">{recipe.title}</Text>
				<Text className="mt-1 text-base text-gray-400">
					{formatMinutes(recipe.minutes)} · serves {recipe.serves}
				</Text>
				{match.missing.length === 0 ? (
					<Text className="mt-3 text-base text-emerald-400">You have everything you need from the fridge.</Text>
				) : (
					<Text className="mt-3 text-base text-amber-300">
						{`You need ${match.missing.length} more: ${match.missing.join(", ")}.`}
					</Text>
				)}

				<Text className="mt-8 text-sm font-semibold uppercase tracking-wide text-gray-400">From the fridge</Text>
				<View className="mt-2">
					{recipe.ingredients.map((ingredient) => (
						<IngredientRow key={ingredient.name} ingredient={ingredient} match={match} />
					))}
				</View>

				{recipe.pantry.length > 0 && (
					<>
						<Text className="mt-6 text-sm font-semibold uppercase tracking-wide text-gray-400">From the cupboard</Text>
						<View className="mt-2">
							{recipe.pantry.map((item) => (
								<View key={item} className="flex-row gap-3 py-1.5">
									<Text className="w-4 text-center text-base text-gray-500">·</Text>
									<Text className="flex-1 text-base text-gray-300">{item}</Text>
								</View>
							))}
						</View>
					</>
				)}

				<Text className="mt-6 text-sm font-semibold uppercase tracking-wide text-gray-400">Method</Text>
				<View className="mb-10 mt-3 gap-4">
					{recipe.steps.map((step, index) => (
						<View key={step} className="flex-row gap-3">
							<View className="h-7 w-7 items-center justify-center rounded-full bg-emerald-500">
								<Text className="text-sm font-bold text-white">{index + 1}</Text>
							</View>
							<Text className="flex-1 text-base leading-6 text-gray-200">{step}</Text>
						</View>
					))}
				</View>
			</ScrollView>
		</View>
	);
}
