export { STAFF_DEGREE, ROLE_TTL } from "./constants";
export type { StaffDegree } from "./constants";
export type { StaffRecord, StaffAssignment, AuthorizationResult } from "./types";
export { hasMinimumDegree, isStaff, getRoleLabel } from "./authorize";
