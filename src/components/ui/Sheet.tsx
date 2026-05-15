// Обёртка над @gorhom/bottom-sheet с темой Fluera и стандартным backdrop
import React, { forwardRef, useCallback } from 'react';
import { ViewStyle } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetBackdropProps, BottomSheetView } from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native-unistyles';

export type SheetRef = BottomSheet;
interface Props { snapPoints: readonly (string|number)[]; onClose?: () => void; children: React.ReactNode; }

const styles = StyleSheet.create((theme) => ({
  bg: { backgroundColor: theme.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28 } satisfies ViewStyle,
  handle: { backgroundColor: `${theme.ink}2E`, width: 36, height: 4, borderRadius: 99 } satisfies ViewStyle,
  content: { paddingHorizontal: 22, paddingBottom: 32 } satisfies ViewStyle,
}));

export const Sheet = forwardRef<SheetRef, Props>(({ snapPoints, onClose, children }, ref) => {
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.15} />
    ),
    [],
  );
  const handleChange = useCallback((i: number) => { if (i === -1) onClose?.(); }, [onClose]);
  return (
    <BottomSheet ref={ref} snapPoints={snapPoints as (string|number)[]} index={-1}
      enablePanDownToClose backgroundStyle={styles.bg} handleIndicatorStyle={styles.handle}
      backdropComponent={renderBackdrop} onChange={handleChange}>
      <BottomSheetView style={styles.content}>{children}</BottomSheetView>
    </BottomSheet>
  );
});
Sheet.displayName = 'Sheet';
