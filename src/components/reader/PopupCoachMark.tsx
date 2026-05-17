import React from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

interface Props {
  visible?: boolean;
  onSkip: () => void;
  onAcknowledge: () => void;
}

export function PopupCoachMark({ visible = true, onSkip, onAcknowledge }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onSkip}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }}>
        <View
          accessibilityViewIsModal
          style={{ margin: 24, padding: 18, backgroundColor: theme.paper, borderRadius: 14 }}
        >
          <Text style={{ color: theme.ink, fontSize: 15 }}>
            {t('translation.coachMarks.longPress', { defaultValue: 'Удержите палец на слове чтобы перевести предложение целиком' })}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16, justifyContent: 'flex-end' }}>
            <Pressable
              onPress={onSkip}
              accessibilityRole="button"
              hitSlop={10}
              style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' }}
            >
              <Text style={{ color: theme.ink2 }}>{t('common.skip', { defaultValue: 'Пропустить' })}</Text>
            </Pressable>
            <Pressable
              onPress={onAcknowledge}
              accessibilityRole="button"
              hitSlop={10}
              style={{ backgroundColor: theme.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={{ color: theme.paper }}>{t('common.gotIt', { defaultValue: 'Понятно' })}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
