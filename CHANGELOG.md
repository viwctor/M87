# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1] - 2026-06-15

### Added
- Animated background across the app: white particles with a subtle film-grain noise. On the login screen they orbit and fall toward the center (the black hole); inside the app they drift gently and sparsely.
- "Install app" button under Settings → App, with installation instructions tailored to each browser (Chrome, Edge, Opera, Brave, Safari, Firefox and iOS) and automatic detection when the app is already installed.
- The version notes now open automatically the first time the app is reloaded after an update.

### Changed
- New deep-black logo and a continuously rotating black-hole icon on the splash, login, header and sidebar.
- App icons (favicon and install icon) now have rounded corners.
- Login screen uses a pure-black background and a larger logo, so the disc appears to float in space.
- The offline state is now a centered window with a blurred backdrop and a red crossed-out Wi-Fi icon, replacing the bottom bar.
- Connection indicator moved to the right on mobile.

### Fixed
- Install instructions no longer always show the Safari text; each browser now gets the right guidance, and an already-installed app is detected even when opened in the browser.

## [1.0] - 2026-06-14

First stable release.

### Added
- Personalized confirmation and password-recovery e-mails, with the M87 banner and the recipient's username.
- Clearer, translated authentication error messages, including a dedicated message for e-mail delivery failures.

### Changed
- The app now starts empty for every account; the schedule comes from the cloud after login (no bundled sample data).
- Cloud saves retry a bounded number of times instead of indefinitely.

### Fixed
- Generic "something went wrong" message on sign-up and password reset now points to the real cause (usually e-mail delivery).

## [0.9 (beta)] - 2026-06-13

### Added
- Real-time synchronization across devices through Supabase Realtime.
- Connection indicator in the header (online, saving, offline) with editing paused while offline.
- Multi-language support: Portuguese, English and Spanish, with automatic detection of the system language.
- Collapsible desktop sidebar and a two-column layout on large screens.
- Per-day cards that group subjects in the Subjects tab.
- Countdown on destructive confirmations (erase data, delete account).
- Real account deletion through a Supabase database function, freeing the email for reuse.
- Notification when only one absence is left and when the limit is reached.
- Character limits on user inputs to protect per-user storage.

### Changed
- Semester labels are stored as structured data and rendered in the active language.
- Authentication error messages are translated and made user-friendly.

### Fixed
- Sign-up with an existing email now reports that the account already exists.
- Confirmation dialog appearing behind the account modal.
- Forgot-password requests are throttled to avoid the email rate limit.

## [0.8 (beta)]

### Added
- Login with USP email and per-user cloud data.
- Subjects tab with information per day, room and professor.
- Guided semester creation (up to 18 semesters).
- Time slots: morning, afternoon, evening, full-time and custom.
- In-app semester selector and a credit-total summary.
- Custom dialogs replacing native browser prompts.
- Calendar that switches semester on swipe, with a Today button.
- Gradient color palette for subjects.
