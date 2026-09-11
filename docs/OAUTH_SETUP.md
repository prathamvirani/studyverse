# Phase 01 OAuth setup

Current accepted scope (Phase 02): **Google and Discord**. Microsoft is intentionally deferred and omitted from the configured-provider list unless `OAUTH_MICROSOFT_ENABLED=true` is explicitly set. Its adapter/setup notes below are retained for a future re-enable. Leave the flag false for the current product scope. Email and phone remain deferred.

The development application origin is **https://localhost:8443**. Trust the local Caddy CA as described in README. Provider registrations must be confidential web applications: exchanges happen on the API server, not in a SPA SDK.

| Provider  | Exact registered redirect URI                    | Requested scopes |
| --------- | ------------------------------------------------ | ---------------- |
| Google    | `https://localhost:8443/auth/callback/google`    | `openid profile` |
| Microsoft | `https://localhost:8443/auth/callback/microsoft` | `openid profile` |
| Discord   | `https://localhost:8443/auth/callback/discord`   | `identify`       |

Use the external HTTPS origin of each deployment in place of localhost. Configure a separate provider registration/environment where practical. Redirects must match exactly; no wildcard or caller-supplied return URL is accepted. A provider console that does not accept this local HTTPS URI needs a developer HTTPS deployment and consistent application/proxy origin configuration.

1. **Google:** create a Web application OAuth client, configure the consent screen and test users as required, and register the Google callback. [Official OpenID Connect reference](https://developers.google.com/identity/openid-connect/reference).
2. **Microsoft:** create an Entra application registration, select the account audience deliberately, add a **Web** redirect and create a client secret. `OAUTH_MICROSOFT_TENANT=common` supports the account types allowed by the registration; set a tenant UUID to restrict the application to that tenant. [Official authorization-code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow).
3. **Discord:** create an application, add the Discord callback and obtain the confidential client ID/secret. No bot installation or guild permissions are needed. The adapter sends S256 PKCE as additional protection and always authenticates the token exchange with the client secret; the general Discord OAuth documentation does not promise PKCE enforcement for every application configuration, so verify it for the registered application rather than relying on it alone. [Official OAuth2 documentation](https://docs.discord.com/developers/topics/oauth2).

Add credentials to ignored `.local/compose.env` using the variable names in `.env.example`. Set both the ID and secret for each enabled provider; an incomplete pair fails startup. With no configured pair, the application stays operational and displays that sign-in is being set up. Never put secrets in `NUXT_PUBLIC_*`, source files, browser storage, screenshots or reports. Keep secrets in a deployment secret manager outside local development.

```dotenv
OAUTH_GOOGLE_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_SECRET=
OAUTH_MICROSOFT_CLIENT_ID=
OAUTH_MICROSOFT_CLIENT_SECRET=
OAUTH_MICROSOFT_TENANT=common
OAUTH_DISCORD_CLIENT_ID=
OAUTH_DISCORD_CLIENT_SECRET=
PHASE01_ENABLED=true
```

Rebuild/restart with `npm run dev` after configuring credentials. For deployment, configure `APP_ORIGIN`, TLS/proxy routing and the three registered redirect URIs consistently. The supplied Compose stack intentionally binds only local ports and is not a public deployment recipe.

For each real provider, verify sign-in, cancellation, a second sign-in reusing the account, browser restart, logout and explicit linking from Account & devices. Automated tests use signed local JWTs and isolated fake provider responses; they do not prove a live console registration or provider consent policy. Do not mark live-provider acceptance complete based on those tests.

Profile data is limited to an opaque provider subject and display name. No provider access/refresh token is retained. Linking does not merge by email. Recent-provider-proof hooks are not a claim of MFA or forced password entry.
