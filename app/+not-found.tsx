// 404-стаб для expo-router (показывается при неизвестном пути).
import React from 'react';
import { View, Text } from 'react-native';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';

const styles = StyleSheet.create((theme) => ({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    backgroundColor: theme.paper,
  },
  text: {
    color: theme.ink,
    fontFamily: 'SourceSerif4-Medium',
    fontSize: 22,
    marginBottom: 12,
  },
  link: {
    color: theme.accent,
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
  },
}));

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{t('notFound.title')}</Text>
      <Link href="/(tabs)" style={styles.link}>
        {t('notFound.back')}
      </Link>
    </View>
  );
}
