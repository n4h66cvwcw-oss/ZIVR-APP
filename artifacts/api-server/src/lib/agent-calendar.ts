/**
 * Calendar writes use the main profile only. Sub-profiles never hold
 * Google or Outlook tokens.
 *
 * TODO(calendar-oauth): when the owner connects a calendar, create the event
 * here with that token and return { calendarWrite: "written", eventId }.
 * Until then a Yes tap is stored on the proposal and no external event is created.
 */

export type CalendarWriteResult =
  | { calendarWrite: "written"; eventId: string }
  | { calendarWrite: "pending_oauth"; todo: string };

export type FreeBusyResult = {
  busy: Array<{ start: number; end: number }>;
  stub: boolean;
  todo?: string;
};

export async function writeMainProfileCalendarEvent(_event: {
  ownerUserId: string;
  title: string;
  startsAt: number;
  endsAt: number;
  note: string | null;
}): Promise<CalendarWriteResult> {
  return {
    calendarWrite: "pending_oauth",
    todo: "Main-profile calendar OAuth is not configured. The Yes tap is saved on the proposal, and no external calendar event was written.",
  };
}

export async function readOwnerFreeBusy(
  _ownerUserId: string,
  _start: number | null,
  _end: number | null,
): Promise<FreeBusyResult> {
  return {
    busy: [],
    stub: true,
    todo: "Main-profile calendar OAuth is not configured, so free/busy is empty until the owner connects a calendar.",
  };
}
