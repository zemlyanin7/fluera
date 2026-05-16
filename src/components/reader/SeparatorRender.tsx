import React from 'react';
import { View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

export const SeparatorRender = React.memo(function SeparatorRender() {
  const { theme } = useUnistyles();
  return (
    <View
      accessibilityRole="none"
      style={{
        marginVertical: 16,
        alignSelf: 'center',
        width: 40,
        height: 1,
        backgroundColor: theme.accentLine,
      }}
    />
  );
});
