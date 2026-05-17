// Custom entry. Порядок важен:
// 1. react-native-get-random-values — shim для crypto.randomUUID() — должен
//    выполниться ДО любого кода WatermelonDB / expo-crypto.
// 2. @/theme — configure Unistyles ДО того как expo-router/entry начнёт
//    через require.context() грузить роуты с top-level StyleSheet.create.
// 3. expo-router/entry — собственно роутинг.
import 'react-native-get-random-values';
import '@/theme';
import 'expo-router/entry';
