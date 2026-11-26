import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { parseNameList } from "@/lib/ingredients";
import { formatMinutes, type RecipeMatch, suggestRecipes } from "@/lib/recipes";

function RecipeCard({ match, fridge }: { match: RecipeMatch; fridge: string }) {
	const { recipe, have, extras, missing } = match;
	const using = [...have.values(), ...extras.values()];

	return (
		<Pressable
			onPress={() => router.push({ pathname: "/recipe/[id]", params: { id: recipe.id, fridge } })}
			accessibilityRole="button"
			className="rounded-2xl bg-gray-800 px-4 py-4 active:bg-gray-700"
		>
			<Text className="text-lg font-semibold text-white">{recipe.title}</Text>
			<Text className="mt-0.5 text-sm text-gray-400">
				{formatMinutes(recipe.minutes)} · serves {recipe.serves}
			</Text>
			<Text className="mt-2 text-sm text-emerald-400" numberOfLines={2}>
				{"Uses "}
				{using.join(", ")}
			</Text>
			{missing.length > 0 && (
				<Text className="mt-1 text-sm text-amber-300">
					{"Missing "}
					{missing.join(", ")}
				</Text>
			)}
		</Pressable>
	);
}

function Section({ title, matches, fridge }: { title: string; matches: RecipeMatch[]; fridge: string }) {
	if (matches.length === 0) {
		return null;
	}
	return (
		<View className="gap-3">
			<Text className="mt-4 text-sm font-semibold uppercase tracking-wide text-gray-400">{title}</Text>
			{matches.map((match) => (
				<RecipeCard key={match.recipe.id} match={match} fridge={fridge} />
			))}
		</View>
	);
}

export default function Recipes() {
	const params = useLocalSearchParams<{ fridge?: string }>();
	const fridge = params.fridge ?? "[]";
	const matches = useMemo(() => suggestRecipes(parseNameList(fridge)), [fridge]);
	const ready = matches.filter((match) => match.missing.length === 0);
	const almost = matches.filter((match) => match.missing.length > 0);

	return (
		<View className="flex-1 bg-gray-900 px-6 pb-safe pt-safe">
			<Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8} className="mt-2 self-start py-2">
				<Text className="text-base text-emerald-400">‹ Ingredients</Text>
			</Pressable>
			<Text className="mt-2 text-2xl font-bold text-white">Recipes for you</Text>
			<Text className="mt-1 text-base text-gray-400">
				{matches.length === 0
					? "Nothing matches yet."
					: `${matches.length} ${matches.length === 1 ? "recipe" : "recipes"} using what you have.`}
			</Text>

			{matches.length === 0 ? (
				<View className="flex-1 justify-center">
					<Text className="text-center text-base text-gray-500">
						{"Try adding a few more ingredients. Basics like eggs, onions or cheese unlock lots of recipes."}
					</Text>
					<View className="mt-6">
						<Button label="Edit ingredients" variant="secondary" onPress={() => router.back()} />
					</View>
				</View>
			) : (
				<ScrollView className="mt-2 flex-1" contentContainerClassName="gap-2 pb-6">
					<Section title="Ready to cook" matches={ready} fridge={fridge} />
					<Section title="Almost there" matches={almost} fridge={fridge} />
				</ScrollView>
			)}
		</View>
	);
}
