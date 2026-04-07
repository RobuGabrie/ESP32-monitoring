import { Platform, ToastAndroid, Alert } from 'react-native';

/**
 * Cross-platform toast/notification helper
 * - Android: Native ToastAndroid
 * - iOS/Web: Alert (or silent on web to avoid disruption)
 */
export function showToast(
  message: string,
  duration: 'SHORT' | 'LONG' = 'SHORT'
): void {
  if (Platform.OS === 'android') {
    const d = duration === 'SHORT' ? ToastAndroid.SHORT : ToastAndroid.LONG;
    ToastAndroid.show(message, d);
  } else if (Platform.OS === 'web') {
    // On web, use console logging instead of intrusive alert
    console.info('[Toast]', message);
  } else {
    // iOS: use Alert as fallback (can be replaced with a custom toast library)
    Alert.alert('Info', message);
  }
}
