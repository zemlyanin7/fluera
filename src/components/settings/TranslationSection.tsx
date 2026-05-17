// Translation popup settings section — gesture mode, smart hints, advanced controls.
// Показывает 2 видимых контрола + Advanced disclosure (раскрывается по тапу).
import React, { useState } from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settingsStore';
import { SentenceTranslationGesture } from '@/types/settings';

export function TranslationSection() {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const settings = useSettingsStore();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={{ color: theme.ink, fontSize: 18, fontWeight: '700' }}>
        {t('settings.translation.heading', { defaultValue: 'Перевод' })}
      </Text>

      {/* Sentence gesture radio group */}
      <View>
        <Text style={{ color: theme.ink2, fontSize: 13 }}>
          {t('settings.translation.sentenceGesture.label', { defaultValue: 'Перевод предложения' })}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          {(['long_press', 'button', 'both'] as const).map((mode: SentenceTranslationGesture) => (
            <Pressable
              key={mode}
              accessibilityRole="radio"
              accessibilityState={{ selected: settings.sentenceTranslationGesture === mode }}
              onPress={() => settings.setSentenceGesture(mode)}
              hitSlop={10}
              style={{
                paddingHorizontal: 14, paddingVertical: 8,
                minHeight: 44, justifyContent: 'center',
                borderRadius: 8,
                backgroundColor: settings.sentenceTranslationGesture === mode ? theme.accent : 'transparent',
                borderWidth: 1, borderColor: theme.accentLine,
              }}
            >
              <Text style={{ color: settings.sentenceTranslationGesture === mode ? theme.paper : theme.ink }}>
                {t(`settings.translation.sentenceGesture.${mode}`, { defaultValue: mode })}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Smart hints combined toggle */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
        <Text style={{ color: theme.ink, fontSize: 14, flex: 1 }}>
          {t('settings.translation.smartHints.label', { defaultValue: 'Умные подсказки' })}
        </Text>
        <Switch
          accessibilityRole="switch"
          value={settings.falseFriendsEnabled && settings.mweAutoExpand}
          onValueChange={(v) => {
            settings.setFalseFriendsEnabled(v);
            settings.setMweAutoExpand(v);
          }}
        />
      </View>

      {/* Advanced disclosure toggle */}
      <Pressable
        onPress={() => setAdvancedOpen(!advancedOpen)}
        accessibilityRole="button"
        accessibilityState={{ expanded: advancedOpen }}
        hitSlop={10}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text style={{ color: theme.ink2 }}>
          {advancedOpen ? '▴' : '▾'}{' '}
          {t('settings.translation.advanced', { defaultValue: 'Продвинутые настройки' })}
        </Text>
      </Pressable>

      {advancedOpen && (
        <View style={{ gap: 10 }}>
          <ToggleRow
            label={t('settings.translation.mweAutoExpand.label', { defaultValue: 'Расширять идиомы при тапе' })}
            value={settings.mweAutoExpand}
            onChange={settings.setMweAutoExpand}
          />
          <ToggleRow
            label={t('settings.translation.registerTags.label', { defaultValue: 'Показывать метки регистра (B2+)' })}
            value={settings.showRegisterTags}
            onChange={settings.setRegisterTags}
          />
          <ToggleRow
            label={t('settings.translation.falseFriends.label', { defaultValue: 'Предупреждать о ложных друзьях' })}
            value={settings.falseFriendsEnabled}
            onChange={settings.setFalseFriendsEnabled}
          />
          <Pressable
            onPress={settings.resetPopupHints}
            accessibilityRole="button"
            hitSlop={10}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={{ color: theme.accent }}>
              {t('settings.translation.resetCoachMark', { defaultValue: 'Сбросить подсказки' })}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const { theme } = useUnistyles();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
      <Text style={{ color: theme.ink, flex: 1 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}
