import { phoneLookupCandidates, type PhoneLookup } from "./phone-number";

export type UserFindPlan =
  | { kind: "phone"; lookup: PhoneLookup }
  | { kind: "phone-exact"; phone: string }
  | { kind: "username"; pattern: string }
  | { kind: "q"; pattern: string }
  | { kind: "none" };

/**
 * GET /users/find query plan.
 * Phone is matched across E.164 and legacy national forms.
 * Username stays a prefix ILIKE; `q` stays a contains ILIKE on name and username.
 * A phone query wins when more than one param is present, same as before.
 */
export function planUserFind(query: {
  phone?: string;
  username?: string;
  q?: string;
}): UserFindPlan {
  const phone = query.phone;
  if (phone) {
    const lookup = phoneLookupCandidates(phone);
    if (lookup) return { kind: "phone", lookup };
    return { kind: "phone-exact", phone };
  }
  if (query.username) {
    return { kind: "username", pattern: query.username + "%" };
  }
  if (query.q) {
    return { kind: "q", pattern: "%" + query.q + "%" };
  }
  return { kind: "none" };
}
