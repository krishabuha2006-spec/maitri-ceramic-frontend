/**
 * Helper to apply data scoping to Mongoose query filters
 *
 * @param {Object} baseFilter - Base MongoDB query filter
 * @param {Object} userPermission - Permission object with dataScope
 * @param {Object} user - Authenticated user object (req.user)
 * @param {Array<String|ObjectId>} teamUserIds - Optional team member IDs for TEAM scope
 * @returns {Object} Filter object modified with dataScope conditions
 */
const applyDataScope = (baseFilter = {}, userPermission = null, user = null, teamUserIds = []) => {
  const filter = { ...baseFilter };

  // If user is Super Admin or no permission object provided, default to ALL
  if (!userPermission || user?.role?.isSystemRole || userPermission.dataScope === 'ALL') {
    return filter;
  }

  const userId = user?._id || user?.id;

  if (userPermission.dataScope === 'OWN') {
    filter.createdBy = userId;
    return filter;
  }

  if (userPermission.dataScope === 'TEAM') {
    const validTeamIds = Array.isArray(teamUserIds) && teamUserIds.length > 0 ? teamUserIds : [userId];
    filter.createdBy = { $in: validTeamIds };
    return filter;
  }

  // Fallback to OWN for safety
  filter.createdBy = userId;
  return filter;
};

module.exports = {
  applyDataScope
};
