# Privacy and safety

How Icarus handles personal information, and the safeguards built into the product. This describes the software; it is not legal advice and not a statement of compliance with any law. Whoever operates a deployment must review it for their jurisdiction (for example India's Digital Personal Data Protection Act 2023, the UK and EU GDPR, or COPPA in the United States) and adapt the in-app privacy notice and terms (`src/web/views/info.ts`).

## Data minimisation

| Data | Where it lives | Sent to the server? |
|---|---|---|
| Audience, saved items, comparison, dietary preferences, meal notes | Browser storage | No |
| Training profile, plans, workout history | Browser storage | Only a short summary, when the person uses an AI coach |
| Location | Browser storage, rounded to 2 decimal places (~1 km) | The rounded position, with gym searches; not stored |
| Enquiries and booking requests | Server (`DATA_DIR/requests.jsonl`) | Yes, when submitted |
| Request reference and access token | Browser storage | The token is sent only to check or withdraw the request |

Forms collect a name, email, optional phone, preferences and a free-text message. They ask only *whether* there is a health matter to discuss, never for details, and the message field asks people not to include medical information.

## Location

- The browser's location permission is requested only after the person presses **Use my location** and reads what it is used for.
- `Permissions-Policy` allows geolocation for this site only; embedded content cannot request it.
- Coordinates are rounded before they are stored or sent. Declining permission leads straight to typed search.

## Children

- A parent or guardian makes every request for a child. The form says so, collects only the guardian's details, the child's age band and the guardian's relationship, and requires explicit guardian consent. The server refuses child requests without it.
- No child's name, photo, profile or precise location is collected or displayed anywhere.
- Children are offered supervised, play-based programmes only. Adult packages, weight-loss goals, calorie targets, nutrition consultations and meal plans are not offered, and the server rejects adult packages and plans for the kids audience.
- Kids' packages are in-person only.

## Health and nutrition

- Training and nutrition content is general information for healthy people. Each programme, gym and request shows audience-specific safety guidance.
- Nutrition education is visibly separated from personalised advice, which comes only from a booked professional. The nutrition page directs people with medical conditions to a doctor or registered dietitian, and anyone struggling with food or weight to an eating-disorder service.
- The AI coach refuses to programme through warning symptoms and never gives weight-loss, dieting or heavy-lifting advice to children.

## Retention and deletion

- Requests are deleted automatically after `REQUEST_RETENTION_DAYS` (default 90) when the server starts; schedule a daily restart, or add a scheduled compaction, so deletion happens promptly in long-running deployments.
- Withdrawing a request erases its contact details and message immediately.
- **Profile → Erase everything on this device** removes all browser data.
- Request files are written with owner-only permissions and contain only a hash of each access token.

## Server-side authorisation

There are no accounts. A request can be read or withdrawn only with its access token. Listing data is public. Adding accounts requires real authentication; see [DEPLOYMENT.md](DEPLOYMENT.md).

## Logging

The server logs that a request was created and whether it was forwarded, with its reference only. It never logs request contents, coach messages or keys.
