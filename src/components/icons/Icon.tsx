// SVG-обёртка для иконок: theme.ink — default stroke, перекрывается prop `color`.
// theme.ink читается inline через useUnistyles() — иначе закэшированный
// StyleSheet.create не подхватывает смену темы (см. PhoneShell.tsx).
import React from 'react';
import { Svg } from 'react-native-svg';
import { useUnistyles } from 'react-native-unistyles';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}

export const Icon: React.FC<IconProps & { children: React.ReactNode }> = ({
  size = 22, color, strokeWidth = 1.8, fill = 'none', children,
}) => {
  const { theme } = useUnistyles();
  const resolvedColor = color ?? theme.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24"
         fill={fill} stroke={resolvedColor} strokeWidth={strokeWidth}
         strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
};
