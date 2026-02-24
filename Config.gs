/**
 * ============================================
 * SYSTEM MANIFEST & GLOBAL CONSTANTS
 * ============================================
 */

const FDS_CONFIG = {
  VERSION: '1.0.1-PRO',
  
  // Sheet Names (Must match SetupCode.gs exactly)
  SHEETS: {
    DATABASE: 'User Database',
    SETTINGS: 'Settings',
    LOGS: 'SystemLogs',
    WELLNESS: 'Wellness',
    AUDITIONS: 'Auditions',
    REHEARSALS: 'Rehearsals'
  },

  // Database Mapping (Column indices for critical lookups)
  // Used for high-speed direct cell updates without fetching JSON
  COLUMNS: {
    SYSTEM_ID: 1,      // Col A
    STUDENT_ID: 2,     // Col B
    EMAIL: 6,          // Col F
    ROLE: 8,           // Col H
    GROUPS: 9,         // Col I
    STATUS: 11,        // Col K
    LAST_LOGIN: 28     // Col AB
  },

  // Default Fallbacks (If Settings sheet is corrupted or empty)
  DEFAULTS: {
    ORG_NAME: 'FDS PRO System',
    PROD_TITLE: 'New Production',
    THEME_COLOR: '#8B0000',
    ROLES: ['Actor', 'Crew', 'Pit', 'Staff', 'Director'],
    GROUPS: ['Cast', 'Leads', 'Ensemble', 'Tech', 'Admin']
  }
};

/**
 * Returns the manifest object.
 * Replaces the old getConfig() to avoid naming collisions with local module configs.
 */
function getSystemManifest() {
  return FDS_CONFIG;
}
