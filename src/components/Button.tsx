import { ActivityIndicator, Pressable, Text } from "react-native";

type ButtonProps = {
	label: string;
	onPress: () => void;
	variant?: "primary" | "secondary";
	loading?: boolean;
	disabled?: boolean;
};

export function Button({ label, onPress, variant = "primary", loading = false, disabled = false }: ButtonProps) {
	const isPrimary = variant === "primary";
	const isDisabled = disabled || loading;

	return (
		<Pressable
			onPress={onPress}
			disabled={isDisabled}
			accessibilityRole="button"
			accessibilityState={{ disabled: isDisabled, busy: loading }}
			className={`w-full flex-row items-center justify-center rounded-full py-4 ${
				isPrimary ? "bg-emerald-500 active:bg-emerald-600" : "active:bg-gray-800"
			} ${isDisabled ? "opacity-60" : ""}`}
		>
			{loading ? (
				<ActivityIndicator color="white" />
			) : (
				<Text className={isPrimary ? "text-lg font-semibold text-white" : "text-base text-gray-300"}>{label}</Text>
			)}
		</Pressable>
	);
}
