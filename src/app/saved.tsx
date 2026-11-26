import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { formatMinutes, getRecipe, type Recipe } from "@/lib/recipes";
import { useSavedRecipeIds } from "@/lib/saved-recipes";

export default function Saved() {
	const recipes = useSavedRecipeIds()
		.map(getRecipe)
		.filter((recipe): recipe is Recipe => recipe !== undefined);

	return (
		<View className="flex-1 bg-gray-900 px-6 pb-safe pt-safe">
			<Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8} className="mt-2 self-start py-2">
				<Text className="text-base text-emerald-400">‹ Home</Text>
			</Pressable>
			<Text className="mt-2 text-2xl font-bold text-white">Saved recipes</Text>

			{recipes.length === 0 ? (
				<View className="flex-1 justify-center">
					<Text className="text-center text-base text-gray-500">
						{"Nothing saved yet. Tap ♡ Save on a recipe to keep it here."}
					</Text>
				</View>
			) : (
				<ScrollView className="mt-4 flex-1" contentContainerClassName="gap-3 pb-6">
					{recipes.map((recipe) => (
						<Pressable
							key={recipe.id}
							onPress={() => router.push({ pathname: "/recipe/[id]", params: { id: recipe.id } })}
							accessibilityRole="button"
							className="rounded-2xl bg-gray-800 px-4 py-4 active:bg-gray-700"
						>
							<Text className="text-lg font-semibold text-white">{recipe.title}</Text>
							<Text className="mt-0.5 text-sm text-gray-400">
								{formatMinutes(recipe.minutes)} · serves {recipe.serves}
							</Text>
						</Pressable>
					))}
				</ScrollView>
			)}
		</View>
	);
}
