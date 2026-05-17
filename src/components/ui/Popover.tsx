import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Modal } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { useUnistyles } from 'react-native-unistyles';

export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PopoverProps {
  visible: boolean;
  placement: 'top' | 'bottom';
  anchorRect: AnchorRect;
  onDismiss: () => void;
  children: React.ReactNode;
}

export function Popover({ visible, placement, anchorRect, onDismiss, children }: PopoverProps) {
  const { theme } = useUnistyles();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: reduceMotion ? 0 : 160 });
    } else {
      opacity.value = 0;
    }
  }, [visible, reduceMotion, opacity]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityRole="none">
        <Animated.View
          style={[
            styles.bubble,
            { backgroundColor: theme.paper, shadowColor: theme.ink },
            placement === 'bottom'
              ? { top: anchorRect.y + anchorRect.height + 8 }
              : { bottom: undefined, top: Math.max(8, anchorRect.y - 200) },
            { left: 16, right: 16 },
            animatedStyle,
          ]}
          accessibilityViewIsModal={true}
          importantForAccessibility="yes"
        >
          {children}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  bubble: {
    position: 'absolute',
    borderRadius: 14,
    padding: 16,
    elevation: 8,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
});
