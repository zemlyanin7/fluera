import { Tabs } from 'expo-router'
import { useTheme } from '@tamagui/core'

export default function TabLayout() {
  const theme = useTheme()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary.val,
        tabBarInactiveTintColor: theme.textMuted.val,
        tabBarStyle: {
          backgroundColor: theme.background.val,
          borderTopColor: theme.borderColor.val,
        },
        headerStyle: {
          backgroundColor: theme.background.val,
        },
        headerTintColor: theme.color.val,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Library', tabBarLabel: 'Library' }}
      />
      <Tabs.Screen
        name="dictionary"
        options={{ title: 'Dictionary', tabBarLabel: 'Dictionary' }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: 'Stats', tabBarLabel: 'Stats' }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarLabel: 'Settings' }}
      />
    </Tabs>
  )
}
