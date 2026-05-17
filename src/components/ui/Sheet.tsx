// Обёртка над @gorhom/bottom-sheet с темой Fluera и стандартным backdrop.
// theme.* читается inline через useUnistyles() — иначе закэшированный
// StyleSheet.create не подхватывает смену темы (см. PhoneShell.tsx).
import React, { forwardRef, useCallback, useMemo } from 'react';
import { ViewStyle, StyleSheet as RN } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetBackdropProps, BottomSheetView } from '@gorhom/bottom-sheet';
import { useUnistyles } from 'react-native-unistyles';

export type SheetRef = BottomSheet;
// I3: prop НЕ readonly — gorhom bottom-sheet типизирует snapPoints как
// mutable массив, при readonly теряли совместимость и приходилось
// делать `as (string|number)[]` cast. Хоститься рекомендуется
// module-level константой (см. I2).
interface Props { snapPoints: (string|number)[]; onClose?: () => void; children: React.ReactNode; }

const staticStyles = RN.create({
  bgBase: { borderTopLeftRadius: 28, borderTopRightRadius: 28 } satisfies ViewStyle,
  handleBase: { width: 36, height: 4, borderRadius: 99 } satisfies ViewStyle,
  content: { paddingHorizontal: 22, paddingBottom: 32 } satisfies ViewStyle,
});

export const Sheet = forwardRef<SheetRef, Props>(({ snapPoints, onClose, children }, ref) => {
  const { theme } = useUnistyles();
  const bgStyle = useMemo<ViewStyle>(
    () => ({ ...staticStyles.bgBase, backgroundColor: theme.paper }),
    [theme.paper],
  );
  const handleStyle = useMemo<ViewStyle>(
    () => ({ ...staticStyles.handleBase, backgroundColor: `${theme.ink}2E` }),
    [theme.ink],
  );
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.15} />
    ),
    [],
  );
  const handleChange = useCallback((i: number) => { if (i === -1) onClose?.(); }, [onClose]);
  return (
    <BottomSheet ref={ref} snapPoints={snapPoints} index={-1}
      enablePanDownToClose backgroundStyle={bgStyle} handleIndicatorStyle={handleStyle}
      backdropComponent={renderBackdrop} onChange={handleChange}>
      <BottomSheetView style={staticStyles.content}>{children}</BottomSheetView>
    </BottomSheet>
  );
});
Sheet.displayName = 'Sheet';
