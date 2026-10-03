export type CapabilityStatus = 'Supported' | 'Unavailable' | 'System-managed' | 'Requires native';
export interface PlatformCapability {
  key: string;
  label: string;
  status: CapabilityStatus;
  detail: string;
}
/** Passive surface discovery only: never requests credentials, permissions or devices. */
export function platformCapabilities(
  browser?: Pick<Window, 'isSecureContext' | 'navigator' | 'document'> & {
    PublicKeyCredential?: unknown;
    PushManager?: unknown;
    documentPictureInPicture?: { requestWindow?: unknown };
  },
): PlatformCapability[] {
  const secure = browser?.isSecureContext === true;
  const nav = browser?.navigator;
  const doc = browser?.document;
  const supported = (value: boolean | undefined): CapabilityStatus =>
    value ? 'Supported' : 'Unavailable';
  const web = (key: string, label: string, available: boolean, detail: string) => ({
    key,
    label,
    status: supported(available),
    detail,
  });
  const native = (key: string, label: string, detail: string): PlatformCapability => ({
    key,
    label,
    status: 'Requires native',
    detail,
  });
  return [
    web(
      'auth.passkeys',
      'Passkeys',
      secure && !!browser?.PublicKeyCredential && !!nav?.credentials,
      'Browser API availability only. Passkey sign-in is not configured in Study Space.',
    ),
    web(
      'share.nativeShare',
      'Native sharing',
      secure && typeof nav?.share === 'function',
      'Sharing requires a user gesture and compatible content.',
    ),
    web(
      'notifications.push',
      'Push notifications',
      secure && !!browser?.PushManager && !!nav && 'serviceWorker' in nav,
      'API availability only; no notification permission or subscription is requested here.',
    ),
    web(
      'notifications.badge',
      'App badges',
      secure && typeof nav?.setAppBadge === 'function',
      'Browser and installation rules may limit badges.',
    ),
    web(
      'media.osControls',
      'Media session controls',
      !!nav && 'mediaSession' in nav,
      'Integration hook for a future personal player. Room media does not install OS control handlers.',
    ),
    web(
      'display.wakeLock',
      'Screen wake lock',
      secure && !!nav && 'wakeLock' in nav,
      'Requires an explicit action, a visible page and platform approval; no lock is acquired here.',
    ),
    web(
      'video.pictureInPicture',
      'Video picture in picture',
      doc?.pictureInPictureEnabled === true,
      'Video support depends on the selected element and browser policy.',
    ),
    web(
      'video.documentPictureInPicture',
      'Floating utility window',
      secure && typeof browser?.documentPictureInPicture?.requestWindow === 'function',
      'Document picture in picture is separate from video support. Existing popouts retain their fallback.',
    ),
    {
      key: 'video.systemEffects',
      label: 'System camera effects',
      status: 'System-managed',
      detail:
        'Select and manage effects in your operating system. The browser cannot verify or control them.',
    },
    {
      key: 'audio.systemEffects',
      label: 'System audio effects',
      status: 'System-managed',
      detail:
        'OS or device effects remain system-managed; browser audio processing uses existing device settings.',
    },
    native('system.liveActivities', 'Live Activities', 'Future Apple native integration.'),
    native(
      'system.widgets',
      'System widgets',
      'Future native integration; no web widget is installed.',
    ),
    native(
      'system.shortcuts',
      'System shortcuts',
      'Future native integration such as App Intents or XDG portals.',
    ),
    native('system.conversations', 'System conversations', 'Future Android/native integration.'),
  ];
}
