import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { ConfirmDialog } from '../vlog/ui/ConfirmDialog';

export type DialogSpec = {
  title: string;
  /** Small line under the title, e.g. the name of the thing being changed. */
  subtitle?: string;
  body?: string;
  /** Stacked top to bottom. The last one is the safest choice; it is also what an outside tap or the back button means. */
  buttons: { label: string; tone?: 'primary' | 'danger' | 'plain'; onPress?: () => void }[];
};
let present: ((spec: DialogSpec) => void) | null = null;
/** Confirmation as a bottom card (spec section 5). Falls back to a system dialog before the host mounts. */
export function dialog(spec: DialogSpec) {
  if (present) present(spec);
  else
    Alert.alert(
      spec.title,
      [spec.subtitle, spec.body].filter(Boolean).join('\n') || undefined,
      spec.buttons.map((b, i) => ({
        text: b.label,
        onPress: b.onPress,
        style: i === spec.buttons.length - 1 ? ('cancel' as const) : b.tone === 'danger' ? ('destructive' as const) : ('default' as const),
      })),
    );
}
export function ConfirmHost() {
  const [spec, setSpec] = useState<DialogSpec | null>(null);
  useEffect(() => {
    present = setSpec;
    return () => {
      present = null;
    };
  }, []);
  if (!spec) return null;
  const choose = (action?: () => void) => {
    setSpec(null);
    action?.();
  };
  return (
    <ConfirmDialog
      visible
      title={spec.title}
      subtitle={spec.subtitle}
      body={spec.body}
      buttons={spec.buttons.map((b) => ({ label: b.label, tone: b.tone, onPress: () => choose(b.onPress) }))}
      onRequestClose={() => choose(spec.buttons[spec.buttons.length - 1]?.onPress)}
    />
  );
}
