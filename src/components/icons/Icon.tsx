import React from 'react';
import { Svg } from 'react-native-svg';
import { StyleSheet } from 'react-native-unistyles';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}

// Unistyles 3.x StyleSheet.create требует style-объекты, поэтому оборачиваем
// цвет темы в style и читаем поле color.
const styles = StyleSheet.create((theme) => ({
  defaultColor: { color: theme.ink },
}));

export const Icon: React.FC<IconProps & { children: React.ReactNode }> = ({
  size = 22, color, strokeWidth = 1.8, fill = 'none', children,
}) => {
  const resolvedColor = color ?? (styles.defaultColor.color as string);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24"
         fill={fill} stroke={resolvedColor} strokeWidth={strokeWidth}
         strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
};
