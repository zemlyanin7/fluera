import React from 'react'
import { Alert, Pressable, StyleSheet } from 'react-native'
import { Text } from 'tamagui'
import * as DocumentPicker from 'expo-document-picker'
import { useTranslation } from 'react-i18next'
import { BookImporter } from '../../services/library/BookImporter'

export function AddBookButton() {
  const { t } = useTranslation()

  const handlePress = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/epub+zip', 'application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
      })

      if (result.canceled || !result.assets?.[0]) return

      const asset = result.assets[0]
      const format = BookImporter.detectFormat(asset.name)
      if (!format) {
        Alert.alert(
          t('library.import.errorTitle'),
          t('library.import.unsupportedFormat'),
        )
        return
      }

      await BookImporter.importFile(asset.uri, asset.name)
      // WatermelonDB observe() in LibraryScreen auto-updates the list
    } catch (error) {
      console.error('Import failed:', error)
      Alert.alert(
        t('library.import.errorTitle'),
        t('library.import.failed'),
      )
    }
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      onPress={handlePress}
    >
      <Text color="#ffffff" fontSize="$4" fontWeight="600">
        {t('library.addBook')}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#6c63ff',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
})
