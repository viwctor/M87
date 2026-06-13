# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses informal pre-release versioning while in beta.

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
