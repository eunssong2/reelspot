// 데모 모드에서 Supabase Auth 를 대신하는 최소 세션 저장소.
// 로그인 → 방 목록 흐름을 그대로 볼 수 있게만 한다.
type Listener = (signedIn: boolean) => void;

let signedIn = false;
const listeners = new Set<Listener>();

export const demoAuth = {
  isSignedIn: () => signedIn,
  set(next: boolean) {
    signedIn = next;
    listeners.forEach((listener) => listener(next));
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
