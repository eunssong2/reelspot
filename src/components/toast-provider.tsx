import React, { createContext, useContext } from 'react';
import { View } from 'react-native';
import { Toast, useToast } from '../vlog/ui/Toast';

const ToastContext = createContext<(message: string) => void>(() => {});

/** Keep brief confirmations visible when the originating screen closes. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  return (
    <ToastContext.Provider value={toast.show}>
      <View style={{ flex: 1 }}>
        {children}
        <Toast message={toast.message} bottom={100} />
      </View>
    </ToastContext.Provider>
  );
}

export const useAppToast = () => useContext(ToastContext);
