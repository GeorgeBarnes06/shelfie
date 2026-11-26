import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "shelfie.savedRecipes.v1";

/** Saved recipe ids, newest first. Kept on the phone; shared by every screen through the hook below. */
let saved: string[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
	for (const listener of listeners) {
		listener();
	}
}

async function load() {
	try {
		const raw = await AsyncStorage.getItem(STORAGE_KEY);
		const parsed: unknown = raw ? JSON.parse(raw) : [];
		if (Array.isArray(parsed)) {
			const stored = parsed.filter((id): id is string => typeof id === "string");
			// Keep anything saved while loading, then the stored ids.
			saved = [...saved, ...stored.filter((id) => !saved.includes(id))];
		}
	} catch (error) {
		console.warn("Couldn't load saved recipes", error);
	}
	loaded = true;
	emit();
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	if (!loaded && listeners.size === 1) {
		void load();
	}
	return () => {
		listeners.delete(listener);
	};
}

function persist() {
	AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved)).catch((error: unknown) => {
		console.warn("Couldn't save recipes", error);
	});
}

export function toggleSavedRecipe(id: string) {
	saved = saved.includes(id) ? saved.filter((savedId) => savedId !== id) : [id, ...saved];
	emit();
	persist();
}

/** Saved recipe ids (newest first). Re-renders when they change on any screen. */
export function useSavedRecipeIds(): string[] {
	return useSyncExternalStore(subscribe, () => saved);
}
