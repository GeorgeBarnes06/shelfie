import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Alert, Text, View } from "react-native";

import { Button } from "@/components/Button";

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
			<View className="flex-1 items-center justify-center">
				<Text className="text-5xl font-bold text-white">Shelfie</Text>
				<Text className="mt-3 text-center text-lg text-gray-400">Snap your fridge. Get cooking.</Text>
			</View>
			<View className="mb-6 gap-3">
				<Button label="Take photo" onPress={takePhoto} />
				<Button label="Choose from library" variant="secondary" onPress={choosePhoto} />
			</View>
		</View>
	);
}
