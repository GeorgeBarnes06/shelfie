import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Button } from "@/components/Button";
import { DETECTION_IS_PLACEHOLDER, displayName, type Ingredient, normaliseName } from "@/lib/ingredients";

function parseIngredients(raw: string | undefined): Ingredient[] {
	if (!raw) {
		return [];
	}
	try {
		return JSON.parse(raw) as Ingredient[];
	} catch {
		return [];
	}
}

export default function Ingredients() {
	const params = useLocalSearchParams<{ ingredients?: string }>();
	const initial = useMemo(() => parseIngredients(params.ingredients), [params.ingredients]);
	const [ingredients, setIngredients] = useState<Ingredient[]>(initial);
	const [newName, setNewName] = useState("");

	function remove(name: string) {
		setIngredients((current) => current.filter((ingredient) => ingredient.name !== name));
	}

	function add() {
		const name = normaliseName(newName);
		if (!name) {
			return;
		}
		if (!ingredients.some((ingredient) => ingredient.name === name)) {
			setIngredients((current) => [...current, { name, count: 1, confidence: null }]);
		}
		setNewName("");
	}

	function findRecipes() {
		Alert.alert("Recipes coming soon", `You'd get recipes using ${ingredients.length} ingredients.`);
	}

	return (
		<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-gray-900">
			<View className="flex-1 px-6 pb-safe pt-safe">
				<Text className="mt-4 text-2xl font-bold text-white">In your fridge</Text>
				<Text className="mt-1 text-base text-gray-400">Remove anything we got wrong and add what we missed.</Text>

				{DETECTION_IS_PLACEHOLDER && (
					<View className="mt-4 rounded-xl bg-amber-500/15 px-4 py-3">
						<Text className="text-sm text-amber-300">{"Sample results: the ingredient detector isn't connected yet."}</Text>
					</View>
				)}

				<ScrollView className="mt-4 flex-1" contentContainerClassName="gap-2 pb-4" keyboardShouldPersistTaps="handled">
					{ingredients.length === 0 && (
						<Text className="py-8 text-center text-base text-gray-500">No ingredients yet. Add some below.</Text>
					)}
					{ingredients.map((ingredient) => (
						<View key={ingredient.name} className="flex-row items-center rounded-xl bg-gray-800 px-4 py-3">
							<View className="flex-1">
								<Text className="text-base font-medium text-white">
									{displayName(ingredient.name)}
									{ingredient.count > 1 ? <Text className="text-gray-400"> ×{ingredient.count}</Text> : null}
								</Text>
								{ingredient.confidence !== null && ingredient.confidence < 0.5 && (
									<Text className="mt-0.5 text-xs text-amber-300">Not sure about this one</Text>
								)}
							</View>
							<Pressable
								onPress={() => remove(ingredient.name)}
								hitSlop={8}
								accessibilityRole="button"
								accessibilityLabel={`Remove ${displayName(ingredient.name)}`}
								className="h-8 w-8 items-center justify-center rounded-full active:bg-gray-700"
							>
								<Text className="text-xl text-gray-400">×</Text>
							</Pressable>
						</View>
					))}
				</ScrollView>

				<View className="flex-row items-center gap-2 border-t border-gray-800 pt-4">
					<TextInput
						value={newName}
						onChangeText={setNewName}
						onSubmitEditing={add}
						placeholder="Add an ingredient"
						placeholderTextColor="gray"
						returnKeyType="done"
						autoCapitalize="none"
						className="flex-1 rounded-xl bg-gray-800 px-4 py-3 text-base text-white"
					/>
					<Pressable
						onPress={add}
						accessibilityRole="button"
						className="rounded-xl bg-gray-700 px-4 py-3 active:bg-gray-600"
					>
						<Text className="text-base font-semibold text-white">Add</Text>
					</Pressable>
				</View>

				<View className="mb-6 mt-4 gap-3">
					<Button label="Find recipes" onPress={findRecipes} disabled={ingredients.length === 0} />
					<Button label="Scan again" variant="secondary" onPress={() => router.dismissAll()} />
				</View>
			</View>
		</KeyboardAvoidingView>
	);
}
