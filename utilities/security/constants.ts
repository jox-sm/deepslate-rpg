export const STAFF_DEGREE = {
  user: 0,
  customerSupport: 1,
  moderator: 2,
  admin: 3,
  superAdmin: 4,
} as const;

export type StaffDegree = (typeof STAFF_DEGREE)[keyof typeof STAFF_DEGREE];

export const ROLE_TTL: Record<number, number | null> = {
  0: 0,
  1: 3 * 86400,
  2: 86400,
  3: 6 * 3600,
  4: null,
};
