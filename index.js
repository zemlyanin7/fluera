// Custom entry: configure Unistyles BEFORE expo-router discovers routes.
// expo-router/entry use require.context() to load all route files; their
// top-level StyleSheet.create((theme) => ...) need StyleSheet.configure()
// to have run. Importing '@/theme' as the very first thing fixes that
// ordering. _layout.tsx still imports it again (no-op due to module cache).
import '@/theme';
import 'expo-router/entry';
