import { Text, View } from "react-native";

export default function Index() {
	return (
		<View className="flex-1 items-center justify-center bg-gray-900 px-6">
			<Text className="text-5xl font-bold text-white">Shelfie</Text>
			<Text className="mt-3 text-center text-lg text-gray-400">Snap your fridge. Get cooking.</Text>
		</View>
	);
}
