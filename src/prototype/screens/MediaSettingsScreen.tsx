import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenFrame } from '../components/ScreenFrame';
import { TemplatePreview } from '../components/TemplatePreview';
import { CUT_OPTIONS, templatesFor, type MediaKind } from '../mock/tripData';
import type { Nav } from '../navigation/routes';
import { colors, GUTTER, radius, shadow } from '../styles/tokens';

const KIND_TABS: { key: MediaKind; label: string; icon: string }[] = [
  { key: 'photo', label: '사진', icon: '🖼️' },
  { key: 'video', label: '동영상', icon: '🎬' },
];

/** 4. 사진·동영상 설정: 종류 탭, 화면 수(1~5컷), 템플릿을 고르고 다음으로 이동한다. */
export function MediaSettingsScreen({ nav, placeName }: { nav: Nav; placeName?: string }) {
  const [kind, setKind] = useState<MediaKind>('photo');
  const [cuts, setCuts] = useState(3);
  const [templateId, setTemplateId] = useState('c3-cols');

  const templates = templatesFor(cuts);

  const changeCuts = (next: number) => {
    setCuts(next);
    // 컷 수가 바뀌면 그 컷 수의 첫 번째 템플릿을 기본 선택한다.
    setTemplateId(templatesFor(next)[0].id);
  };

  return (
    <ScreenFrame>
      <AppHeader title="사진·동영상 올리기" subtitle={placeName} onBack={nav.back} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.kindRow}>
          {KIND_TABS.map((t) => {
            const active = t.key === kind;
            return (
              <Pressable
                key={t.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setKind(t.key)}
                style={[styles.kindTab, active && styles.kindTabActive]}
              >
                <Text style={styles.kindIcon}>{t.icon}</Text>
                <Text style={[styles.kindText, active && styles.kindTextActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>화면 수 선택</Text>
        <View style={styles.cutRow}>
          {CUT_OPTIONS.map((n) => {
            const active = n === cuts;
            return (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => changeCuts(n)}
                style={[styles.cut, active && styles.cutActive]}
              >
                <Text style={[styles.cutText, active && styles.cutTextActive]}>{n}컷</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>템플릿 선택</Text>
        <View style={styles.templates}>
          {templates.map((t) => {
            const active = t.id === templateId;
            return (
              <Pressable
                key={t.id}
                accessibilityRole="button"
                accessibilityLabel={`${t.label} 템플릿`}
                accessibilityState={{ selected: active }}
                onPress={() => setTemplateId(t.id)}
                style={styles.templateWrap}
              >
                <View style={[styles.template, active && styles.templateActive]}>
                  <TemplatePreview rects={t.rects} width={72} height={92} selected={active} />
                </View>
                <Text style={[styles.templateLabel, active && styles.templateLabelActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label="다음" onPress={() => nav.push({ name: 'imageUpload', cuts, templateId, kind })} />
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingBottom: 24, gap: 14 },
  kindRow: { flexDirection: 'row', gap: 10 },
  kindTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: radius.item,
    backgroundColor: colors.primarySoft,
  },
  kindTabActive: { backgroundColor: colors.primary, boxShadow: shadow.card },
  kindIcon: { fontSize: 16 },
  kindText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  kindTextActive: { color: colors.onPrimary },
  section: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 8 },
  cutRow: { flexDirection: 'row', gap: 8 },
  cut: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cutActive: { backgroundColor: colors.primary, borderColor: colors.primary, boxShadow: shadow.soft },
  cutText: { fontSize: 14, fontWeight: '700', color: colors.textSub },
  cutTextActive: { color: colors.onPrimary },
  templates: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  templateWrap: { alignItems: 'center', gap: 6 },
  template: {
    padding: 7,
    borderRadius: radius.item,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
  },
  templateActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  templateLabel: { fontSize: 12, color: colors.textSub, fontWeight: '600' },
  templateLabelActive: { color: colors.primary },
  footer: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 16 },
});
