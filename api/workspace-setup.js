const security = require('../server/welcomeflowApiSecurity');
const { createWorkspaceSetupHandler } = require('../server/workspaceSetupAccess');

// Disabled unless explicitly enabled in the approved synthetic Test runtime.
module.exports = createWorkspaceSetupHandler(security);
