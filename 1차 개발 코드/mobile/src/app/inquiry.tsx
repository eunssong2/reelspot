import { useInitialize } from '../lib/effects';
import React, { useState } from 'react';
import { Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../lib/api';
import { inputText } from '../lib/validation';
import { Screen, Field, Button, P, useAction } from '../components/ui';
const categories: Record<string,string> = { other: '일반 문의', upload: '전송·저장', report: '신고·운영 조치 이의', recovery: '방장 부재 복구', consent: '동의·개인정보', deletion: '삭제' };
export default function Inquiry() {
  const params = useLocalSearchParams<{ referenceId?: string; category?: string }>();
  const [reason, setReason] = useState(''), [reference, setReference] = useState(params.referenceId ?? ''), [category, setCategory] = useState(params.category && categories[params.category] ? params.category : 'other'), [email, setEmail] = useState<string | null>(null);
  const a = useAction();
  useInitialize(() => { a.run(async () => { const c = await api('/app-config'); setEmail(c.supportEmail); }); }, []);
  return <Screen title="문의하기">
    {Object.entries(categories).map(([id,name]) => <Button key={id} secondary={category !== id} onPress={() => setCategory(id)}>{name}</Button>)}
    <Field label="문의 내용 · 최대 2000자" value={reason} onChangeText={setReason} multiline />
    <Field label="관련 요청 번호 · 선택" value={reference} onChangeText={setReference} />
    <P>접수 결과와 답변은 설정의 알림 · 신고·문의 결과에서 확인할 수 있습니다.</P>
    <Button disabled={a.busy || !reason.trim()} onPress={() => a.run(async () => { inputText(reason, '문의 내용', 2000, true, true); if (reference) inputText(reference, '관련 요청 번호', 200); await api('/inquiries', { category, reason, ...(reference ? { referenceId: reference } : {}) }); router.replace('/notifications'); })}>문의 접수</Button>
    {email && <Button secondary onPress={() => Linking.openURL(`mailto:${email}`)}>이메일 문의 · {email}</Button>}
    {a.errorView}
  </Screen>;
}
