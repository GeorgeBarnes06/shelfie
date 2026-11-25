import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Image, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { base64SizeKb, prepareFridgePhoto } from "@/lib/photo";

export default function Review() {
	const params = useLocalSearchParams<{ uri: string; width: string; height: string }>();
	const [preparing, setPreparing] = useState(false);

	async function findIngredients() {
		setPreparing(true);
		try {
			const photo = await prepareFridgePhoto({
				uri: params.uri,
				width: Number(params.width),
				height: Number(params.height),
			});
			// TODO: send photo.base64 to the ingredient detection Edge Function.
			Alert.alert(
				"Photo ready",
				`${photo.width}×${photo.height}, about ${base64SizeKb(photo.base64)} KB. Ingredient detection isn't connected yet.`,
			);
		} catch (error) {
			console.error(error);
			Alert.alert("Something went wrong", "We couldn't process that photo. Please try again.");
		} finally {
			setPreparing(false);
		}
	}

	if (!params.uri) {
		return (
			<View className="flex-1 items-center justify-center bg-gray-900 px-6">
				<Text className="text-lg text-gray-300">No photo selected.</Text>
				<View className="mt-6 w-full">
					<Button label="Go back" onPress={() => router.back()} />
				</View>
			</View>
		);
	}

	return (
		<View className="flex-1 bg-gray-900 px-6 pb-safe pt-safe">
			<Text className="mt-4 text-2xl font-bold text-white">Looking good?</Text>
			<Text className="mt-1 text-base text-gray-400">Make sure the shelves are clear and well lit.</Text>
			<Image source={{ uri: params.uri }} className="my-6 w-full flex-1 rounded-2xl bg-gray-800" resizeMode="cover" />
			<View className="mb-6 gap-3">
				<Button label="Find ingredients" onPress={findIngredients} loading={preparing} />
				<Button label="Retake" variant="secondary" onPress={() => router.back()} disabled={preparing} />
			</View>
		</View>
	);
}
