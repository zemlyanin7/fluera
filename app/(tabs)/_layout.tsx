import { Tabs } from 'expo-router'
import { useTheme } from '@tamagui/core'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'

export default function TabLayout() {
  const theme = useTheme()
  const { t } = useTranslation()

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
        options={{
          title: t('tabs.library'),
          tabBarLabel: t('tabs.library'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="library-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dictionary"
        options={{
          title: t('tabs.dictionary'),
          tabBarLabel: t('tabs.dictionary'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t('tabs.stats'),
          tabBarLabel: t('tabs.stats'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarLabel: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
