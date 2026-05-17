import React, { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

interface Props {
  visible: boolean;
  onUndo: () => void;
}

export function HeartUndoChip({ visible, onUndo }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const [show, setShow] = useState(visible);

  useEffect(() => {
    if (!visible) {
      setShow(false);
      return;
    }
    setShow(true);
    const timer = setTimeout(() => setShow(false), 3000);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!show) return null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onUndo}
      hitSlop={10}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: theme.paper2,
        borderRadius: 12,
        minHeight: 32,
      }}
    >
      <Text style={{ color: theme.ink2, fontSize: 12 }}>
        ↶ {t('common.undo', { defaultValue: 'Отменить' })}
      </Text>
    </Pressable>
  );
}
