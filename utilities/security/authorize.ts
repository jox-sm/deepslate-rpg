import { STAFF_DEGREE, StaffDegree } from "./constants";

export function hasMinimumDegree(currentDegree: number, minimum: StaffDegree): boolean {
  return currentDegree >= minimum;
}

export function isStaff(degree: number): boolean {
  return degree > STAFF_DEGREE.user;
}

export function getRoleLabel(degree: number): string {
  switch (degree) {
    case STAFF_DEGREE.superAdmin:
      return "Super Admin";
    case STAFF_DEGREE.admin:
      return "Admin";
    case STAFF_DEGREE.moderator:
      return "Moderator";
    case STAFF_DEGREE.customerSupport:
      return "Customer Support";
    default:
      return "User";
  }
}
