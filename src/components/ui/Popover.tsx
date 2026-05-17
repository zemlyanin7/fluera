import React from 'react';
import { View, Pressable, StyleSheet, Modal } from 'react-native';
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
  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityRole="none">
        <View
          style={[
            styles.bubble,
            { backgroundColor: theme.paper, shadowColor: theme.ink },
            placement === 'bottom'
              ? { top: anchorRect.y + anchorRect.height + 8 }
              : { bottom: undefined, top: Math.max(8, anchorRect.y - 200) },
            { left: 16, right: 16 },
          ]}
          accessibilityViewIsModal={true}
          importantForAccessibility="yes"
        >
          {children}
        </View>
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
