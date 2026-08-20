import { query, queryOne } from "./db";
import { sendExpoPush } from "./push";
import { getIO } from "./socket";

export type ApprovalStatus = "approved" | "pending" | "blocked" | "none";
export const MAX_GROUP_MEMBERS = 50;

/**
 * Result of checking whether two users are allowed to chat directly.
 * `allowed` is true when neither user is a child, or every child↔contact
 * pair involved has an `approved` row in vm_contact_approvals.
 */
export interface ContactCheckResult {
  allowed: boolean;
  /** Overall status shown to the requester: blocked wins over pending. */
  status: "approved" | "pending" | "blocked";
  /** Child/contact pairs that are not approved yet. */
  unapprovedPairs: Array<{ childId: string; contactId: string; status: ApprovalStatus }>;
}

async function getApprovalStatus(childId: string, contactId: string): Promise<ApprovalStatus> {
  const row = await queryOne<{ status: string }>(
    `SELECT status FROM vm_contact_approvals WHERE child_id = $1 AND contact_id = $2`,
    [childId, contactId]
  );
  return (row?.status as ApprovalStatus) ?? "none";
}

/**
 * Check contact approval for a direct chat between two users.
 * If either user is a child account, the other user must be approved by the
 * child's parent. Parents are always implicitly approved for their own child.
 */
export async function checkDirectContactAllowed(
  userA: string,
  userB: string
): Promise<ContactCheckResult> {
  const users = await query<{ id: string; account_type: string }>(
    `SELECT id, account_type FROM vm_users WHERE id = $1 OR id = $2`,
    [userA, userB]
  );

  const unapprovedPairs: ContactCheckResult["unapprovedPairs"] = [];
  let blocked = false;

  for (const u of users) {
    if (u.account_type !== "child") continue;
    const childId = u.id;
    const contactId = childId === userA ? userB : userA;

    // A child's own parent is always allowed to message them
    const isParent = await queryOne<{ parent_id: string }>(
      `SELECT parent_id FROM vm_parent_child WHERE parent_id = $1 AND child_id = $2`,
      [contactId, childId]
    );
    if (isParent) continue;

    const status = await getApprovalStatus(childId, contactId);
    if (status === "approved") continue;
    if (status === "blocked") blocked = true;
    unapprovedPairs.push({ childId, contactId, status });
  }

  if (unapprovedPairs.length === 0) {
    return { allowed: true, status: "approved", unapprovedPairs };
  }
  return { allowed: false, status: blocked ? "blocked" : "pending", unapprovedPairs };
}

/**
 * Check every unique member pair in a group chat. A group is allowed only
 * when every child↔contact pair is approved (or is the child's parent).
 */
export async function checkGroupContactsAllowed(
  userIds: string[]
): Promise<ContactCheckResult> {
  const members = [...new Set(userIds)];
  const users = await query<{ id: string; account_type: string }>(
    `SELECT id, account_type FROM vm_users WHERE id = ANY($1::uuid[])`,
    [members]
  );
  const childIds = users
    .filter((user) => user.account_type === "child")
    .map((user) => user.id);
  const unapprovedPairs: ContactCheckResult["unapprovedPairs"] = [];
  let blocked = false;

  if (childIds.length === 0) {
    return { allowed: true, status: "approved", unapprovedPairs };
  }

  const [parentLinks, approvals] = await Promise.all([
    query<{ parent_id: string; child_id: string }>(
      `SELECT parent_id, child_id
         FROM vm_parent_child
        WHERE child_id = ANY($1::uuid[]) AND parent_id = ANY($2::uuid[])`,
      [childIds, members]
    ),
    query<{ child_id: string; contact_id: string; status: ApprovalStatus }>(
      `SELECT child_id, contact_id, status
         FROM vm_contact_approvals
        WHERE child_id = ANY($1::uuid[]) AND contact_id = ANY($2::uuid[])`,
      [childIds, members]
    ),
  ]);
  const parentPairs = new Set(parentLinks.map((link) => `${link.child_id}:${link.parent_id}`));
  const approvalByPair = new Map(
    approvals.map((approval) => [
      `${approval.child_id}:${approval.contact_id}`,
      approval.status,
    ])
  );

  for (const childId of childIds) {
    for (const contactId of members) {
      if (childId === contactId || parentPairs.has(`${childId}:${contactId}`)) continue;
      const status = approvalByPair.get(`${childId}:${contactId}`) ?? "none";
      if (status === "approved") continue;
      if (status === "blocked") blocked = true;
      unapprovedPairs.push({ childId, contactId, status });
    }
  }

  if (unapprovedPairs.length === 0) {
    return { allowed: true, status: "approved", unapprovedPairs };
  }
  return { allowed: false, status: blocked ? "blocked" : "pending", unapprovedPairs };
}

/**
 * For each unapproved (non-blocked) child/contact pair, insert a pending
 * approval row and notify the child's parent(s) via push + in-app socket event.
 */
export async function requestApprovalAndNotifyParents(
  pairs: Array<{ childId: string; contactId: string; status: ApprovalStatus }>
): Promise<void> {
  for (const pair of pairs) {
    if (pair.status === "blocked") continue;

    const inserted = await queryOne<{ child_id: string }>(
      `INSERT INTO vm_contact_approvals (child_id, contact_id, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (child_id, contact_id) DO NOTHING
       RETURNING child_id`,
      [pair.childId, pair.contactId]
    );

    // Only notify parents when a brand-new request was created — avoids
    // re-notifying on every retry while a request is still pending.
    if (!inserted) continue;

    try {
      const child = await queryOne<{ display_name: string }>(
        `SELECT display_name FROM vm_users WHERE id = $1`,
        [pair.childId]
      );
      const contact = await queryOne<{ display_name: string }>(
        `SELECT display_name FROM vm_users WHERE id = $1`,
        [pair.contactId]
      );
      const parents = await query<{ id: string; push_token: string | null }>(
        `SELECT u.id, u.push_token
           FROM vm_parent_child pc
           JOIN vm_users u ON u.id = pc.parent_id
          WHERE pc.child_id = $1`,
        [pair.childId]
      );

      const childName = child?.display_name ?? "Your child";
      const contactName = contact?.display_name ?? "someone new";
      const title = "New contact request";
      const body = `${childName} wants to chat with ${contactName}. Review the request in Parental Controls.`;

      // In-app notification over socket
      const io = getIO();
      if (io) {
        for (const p of parents) {
          io.to(`user:${p.id}`).emit("contact:request", {
            childId: pair.childId,
            childName,
            contactId: pair.contactId,
            contactName,
            requestedAt: Date.now(),
          });
        }
      }

      // Push notification
      const tokens = parents
        .map((p) => p.push_token)
        .filter((t): t is string => !!t && t.startsWith("ExponentPushToken"));
      if (tokens.length > 0) {
        await sendExpoPush(tokens, title, body, "default");
      }
    } catch (err) {
      console.warn("[approvals] failed to notify parent:", err);
    }
  }
}
