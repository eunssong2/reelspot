import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Expo retains AppContext when Android recreates an Activity (e.g. font scale).
// Rebind its retained launcher to the current lifecycle before launching again.
const path = fileURLToPath(new URL('../node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/activityresult/AppContextActivityResultRegistry.kt', import.meta.url));
const marker = '// ATP_REBIND_ACTIVITY_RESULT';
const source = readFileSync(path, 'utf8');
if (!source.includes(marker)) {
  const old = '      override fun launch(input: I, callback: ActivityResultCallback<O>) {\n';
  if (!source.includes(old)) throw new Error('Expo ActivityResult source changed; review the lifecycle patch before building.');
  writeFileSync(path, source.replace(old, old + `        ${marker}
        if (keyToLifecycleContainers[key]?.lifecycle !== activity.lifecycle) {
          unregister(key)
          register(key, activity, contract, fallbackCallback).launch(input, callback)
          return
        }
`));
}
// ImagePicker's coroutine can start on a worker thread, but Lifecycle observers
// and Activity launches must run on Main. Keep failures in the calling coroutine
// so they reject the JS promise instead of crashing a posted UI callback.
const launcherPath = fileURLToPath(new URL('../node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/activityresult/AppContextActivityResultLauncher.kt', import.meta.url));
const launcher = readFileSync(launcherPath, 'utf8');
const mainMarker = '// ATP_ACTIVITY_RESULT_MAIN';
if (!launcher.includes(mainMarker)) {
  const begin = '  suspend fun launch(input: I): O = suspendCancellableCoroutine { continuation ->';
  const end = '\n  abstract val contract:';
  if (!launcher.includes(begin) || !launcher.includes(end)) throw new Error('Expo launcher source changed; review Main dispatch patch.');
  writeFileSync(launcherPath, launcher
    .replace('import kotlinx.coroutines.suspendCancellableCoroutine', 'import kotlinx.coroutines.Dispatchers\nimport kotlinx.coroutines.withContext\nimport kotlinx.coroutines.suspendCancellableCoroutine')
    .replace(begin, `  ${mainMarker}\n  suspend fun launch(input: I): O = withContext(Dispatchers.Main.immediate) {\n    suspendCancellableCoroutine { continuation ->`)
    .replace(end, '\n  }\n' + end));
}
