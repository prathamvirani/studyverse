# Passive platform capabilities

MID-07 adds `apps/web/app/lib/platform-capabilities.ts` and a read-only Room Settings → Diagnostics panel. The browser surface is inspected after mounting. SSR renders a checking state; no browser globals are touched during module initialization. No permission, authenticator, notification, wake-lock, capture or sharing request occurs during discovery.

Supported means the API exists in the current context, not that permission is granted, an authenticator is available or an operating-system action will succeed. Secure-context requirements are checked for credentials, sharing, notifications, badges, wake lock and Document PiP. Video PiP uses the browser's enabled flag. Video PiP and Document PiP remain distinct. System effects are explicitly system-managed; the web app cannot detect or toggle the actual OS effects. Existing browser audio/device controls retain their current owner.

The capability keys cover `auth.passkeys`, `share.nativeShare`, `notifications.push`, `notifications.badge`, `media.osControls`, `display.wakeLock`, `video.pictureInPicture`, `video.documentPictureInPicture`, `video.systemEffects`, `audio.systemEffects`, and `system.liveActivities/widgets/shortcuts/conversations`. This is presentation-only discovery, with no identity-provider, membership, authority or permission changes. Existing popout fallback remains intact.

Media Session availability is a future Phase-09 integration hook. No handlers, metadata owner or Personal Study Player are installed by MID-07. Any future implementation must explicitly arbitrate ownership and preserve room media/provider lifecycle.

Future native guidance:

- macOS Continuity Camera and camera effects remain in system/device UI. A future native app may expose documented, supported integration with permission and lifecycle handling.
- Windows Studio Effects remain OS-managed; an available camera does not establish effect availability.
- Android credential, media and conversation integrations need a native application, platform-supported credentials and explicit notification/conversation policy.
- Apple Live Activities and Shortcuts/App Intents need native targets, entitlements and lifecycle ownership. Web capability presence does not imply these integrations.
- Linux MPRIS and XDG portals require an explicit native bridge; the browser Media Session surface is not evidence of direct D-Bus or portal access.

Reference contracts: [WebAuthn](https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredential), [video PiP availability](https://developer.mozilla.org/en-US/docs/Web/API/Document/pictureInPictureEnabled), and [Playwright loopback network forwarding](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-option-expose-network). The optional `tests/visual/platform.config.ts` connects to an ephemeral Linux Playwright server bound to host loopback. It forwards only loopback traffic to the existing isolated fixture, without exposing its test credentials to the network or changing Docker application services.
