import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { useSavedRecipeIds } from "@/lib/saved-recipes";

const pickerOptions: ImagePicker.ImagePickerOptions = {
	mediaTypes: ["images"],
	quality: 1,
};

function openReview(result: ImagePicker.ImagePickerResult) {
	if (result.canceled) {
		return;
	}
	const { uri, width, height } = result.assets[0];
	router.push({ pathname: "/review", params: { uri, width: String(width), height: String(height) } });
}

export default function Index() {
	const savedCount = useSavedRecipeIds().length;

	async function takePhoto() {
		const permission = await ImagePicker.requestCameraPermissionsAsync();
		if (!permission.granted) {
			Alert.alert("Camera access needed", "Allow camera access in Settings to snap your fridge.");
			return;
		}
		openReview(await ImagePicker.launchCameraAsync(pickerOptions));
	}

	async function choosePhoto() {
		openReview(await ImagePicker.launchImageLibraryAsync(pickerOptions));
	}

	return (
		<View className="flex-1 bg-gray-900 px-6 pb-safe pt-safe">
			{savedCount > 0 && (
				<Pressable
					onPress={() => router.push("/saved")}
					accessibilityRole="button"
					hitSlop={8}
					className="mt-2 self-end rounded-full bg-gray-800 px-4 py-2 active:bg-gray-700"
				>
					<Text className="text-sm font-semibold text-white">♥ Saved ({savedCount})</Text>
				</Pressable>
			)}
			<View className="flex-1 items-center justify-center">
				<Text className="text-5xl font-bold text-white">Shelfie</Text>
				<Text className="mt-3 text-center text-lg text-gray-400">Snap your fridge. Get cooking.</Text>
			</View>
			<View className="mb-6 gap-3">
				<Button label="Take photo" onPress={takePhoto} />
				<Button label="Choose from library" variant="secondary" onPress={choosePhoto} />
				<Button label="Type ingredients instead" variant="secondary" onPress={() => router.push("/ingredients")} />
			</View>
		</View>
	);
}
