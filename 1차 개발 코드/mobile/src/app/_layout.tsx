import React, { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { Provider, useAccount } from '../lib/state';
import { StatusBar } from 'expo-status-bar';
import { AppState } from 'react-native';
import { restorePendingTransfers } from '../lib/uploads';
import { setVideoCacheSizeAsync } from 'expo-video';
import { accessLostEvents } from '../lib/api';
function TransferRecovery() {
  const { ready, session } = useAccount();
  const userId = session?.userId;
  useEffect(() => {
    if (!ready || !userId) return;
    let active = true, running = false;
    const recover = async () => { if (running || !active) return; running = true; try { await restorePendingTransfers(); } finally { running = false; } };
    void recover(); const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void recover(); });
    return () => { active = false; sub.remove(); };
  }, [ready, userId]);
  return null;
}
export default function Layout() {
  useEffect(() => {
    void setVideoCacheSizeAsync(500000000).catch(() => {});
    const leave = () => router.replace('/mine');
    accessLostEvents.add(leave);
    return () => {
      accessLostEvents.delete(leave);
    };
  }, []);
  return (
    <Provider>
      <TransferRecovery />
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F6F3EC' } }} />
    </Provider>
  );
}
