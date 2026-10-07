// Club-wide constants. Most day-to-day options (fees, absence policy, club
// days...) are edited by the super admin on the Settings page instead.

// The one account that can promote teachers and change settings. It must sign
// in with this email AND verify it (Google sign-in is verified automatically).
// If you change it, change it in firestore.rules too.
export const SUPER_ADMIN_EMAIL = 'r45t6er7@gmail.com';

export const CLUB_NAME = 'AClub';
export const LOCATION_NAME = 'Northhill';

// Google Analytics (page views only). Set to false to turn it off.
export const ENABLE_ANALYTICS = true;

// Staff accounts are signed out after this many minutes without activity.
export const STAFF_IDLE_TIMEOUT_MINUTES = 30;
