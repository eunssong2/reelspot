import { useInitialize } from '../lib/effects';
import React, { useState } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { api, documentUrl } from '../lib/api';
import { Screen, Button, Card, H, P, useAction } from '../components/ui';
export default function Consents() {
  const [docs, setDocs] = useState<any[]>([]),
    [receipts, setReceipts] = useState<any[]>([]);
  const a = useAction();
  async function load() {
    setDocs((await api('/consent-documents')).documents);
    setReceipts((await api('/me/consents')).consentReceipts);
  }
  useInitialize(() => {
    a.run(load);
  }, []);
  return (
    <Screen title="약관과 동의 내역">
      {docs.map((d) => {
        const receipt = receipts.find((r) => r.documentId === d.id);
        return (
          <Card key={d.id}>
            <H>
              {d.title || d.itemKey} · {d.kind === 'notice' ? '안내' : d.required ? '필수' : '선택'}
            </H>
            <P>
              버전 {d.version} · {d.kind === 'notice' ? '동의 없이 제공하는 처리 안내' : receipt?.agreed ? '동의함' : '동의하지 않음'}
            </P>
            <P>{receipt?.occurredAt}</P>
            <Button secondary onPress={() => Linking.openURL(documentUrl(d.url))}>
              문서 열람
            </Button>
            {d.kind !== 'notice' && <Button
              secondary
              onPress={() =>
                d.required && receipt?.agreed
                  ? router.push('/delete-account')
                  : a.run(async () => {
                      await api(
                        '/me/consents',
                        {
                          items: [
                            { documentId: d.id, version: d.version, agreed: d.required ? true : !receipt?.agreed },
                          ],
                        },
                        'PATCH',
                      );
                      await load();
                    })
              }
            >
              {d.required
                ? receipt?.agreed ? '이용계약 종료·계정 삭제' : '필수 동의하고 계속'
                : receipt?.agreed
                  ? '선택 동의 철회'
                  : '선택 동의'}
            </Button>}
          </Card>
        );
      })}
      {a.errorView}
    </Screen>
  );
}
