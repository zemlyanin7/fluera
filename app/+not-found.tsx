// 404-стаб для expo-router (показывается при неизвестном пути).
import React from 'react';
import { View, Text } from 'react-native';
import { Link } from 'expo-router';
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
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>Страница не найдена</Text>
      <Link href="/(tabs)" style={styles.link}>
        Вернуться
      </Link>
    </View>
  );
}
