import { router } from 'expo-router';

export function goBackOrReplace(fallbackHref: string) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallbackHref as never);
  }
}
