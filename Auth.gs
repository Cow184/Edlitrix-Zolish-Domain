/**
 * ============================================
 * AUTHENTICATION & PERMISSIONS (PRO VERSION)
 * ============================================
 */

function getSecurityContext() {
  const props = PropertiesService.getScriptProperties();
  return {
    currentUserEmail: Session.getActiveUser().getEmail(),
    ownerEmail: props.getProperty('owner_email'),
    isInitialized: props.getProperty('system_initialized') === 'true'
  };
}

/**
 * Verifies if the current user is allowed to edit a specific module
 * based on the JSON configuration in Settings.
 */
function checkUserAccess(moduleName, accessType = 'view') {
  const user = Session.getActiveUser().getEmail();
  const context = getSecurityContext();
  
  // 1. System Owner always has access
  if (context.ownerEmail === user) return true;
  
  // 2. Fetch Module Config from Settings
  const settings = getSystemSettings(); // Defined in Code.gs
  let config = {};
  try { config = JSON.parse(settings.module_config || '{}'); } catch(e) {}
  
  const modConf = config[moduleName];
  if (!modConf) return false;
  if (modConf.enabled === false) return false;
  
  // 3. Check Groups (Assuming user's groups are stored in 'User Database')
  const userRecord = getUserByEmail(user);
  if (!userRecord) return false;
  
  const userGroups = (userRecord.Groups || "").split(',').map(g => g.trim());
  const allowedGroups = modConf[accessType] || [];
  
  return userGroups.some(g => allowedGroups.includes(g));
}

function getUserByEmail(email) {
  const people = getSheetDataAsJSON(FDS_SHEETS.DATABASE);
  return people.find(p => p.Email === email) || null;
}
