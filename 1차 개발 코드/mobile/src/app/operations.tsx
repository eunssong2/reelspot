import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusLoad } from '../lib/effects';
import { api, currentSession, ApiError } from '../lib/api';
import { Screen, Button, Card, H, P, useAction } from '../components/ui';
export default function Operations() {
  const { id } = useLocalSearchParams<{ id?: string }>(), [items, setItems] = useState<any[]>([]);
  const a = useAction();
  async function load() {
    const saved: string[] = JSON.parse((await AsyncStorage.getItem(`atp.operations:${currentSession()?.userId}`)) ?? '[]');
    const ids = [...new Set([...(id ? [id] : []),...saved])], result = [];
    for (const operationId of ids) { try { result.push(await api(`/operations/${operationId}`)); } catch { result.push({ operationId, state: 'unknown' }); } }
    setItems(result);
  }
  useFocusLoad(() => { a.run(load); }, [id]);
  return <Screen title="처리 상태 확인" subtitle="서버가 접수한 요청의 최종 결과를 확인합니다.">
    {items.map((item) => <Card key={item.operationId}><H>{({ pending: '처리 중', review: '운영 검토 중', succeeded: '완료', failed: '실패', unknown: '결과 확인 필요' } as Record<string,string>)[item.state] ?? item.state}</H><P>요청 번호 {item.operationId}</P>{item.itemErrors?.map((e: any,i: number) => <P key={i}>{new ApiError(e.code).message}</P>)}
      {item.state === 'succeeded' && <Button secondary onPress={() => router.replace('/')}>홈에서 결과 확인</Button>}
      <Button secondary onPress={() => router.push({ pathname: '/inquiry', params: { referenceId: item.operationId } })}>이 요청 문의</Button>
    </Card>)}
    {a.hasRun && !a.busy && !items.length && <P>보류 중인 요청이 없습니다.</P>}
    <Button secondary disabled={a.busy} onPress={() => a.run(load)}>결과 새로고침</Button>{a.errorView}
  </Screen>;
}
