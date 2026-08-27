/**
 * Google Calendar 連携のプレースホルダ（Phase 2）。
 * タスク作成・完了・リスケ時に呼び出すが、未設定なら no-op。
 */

export type GcalEventInput = {
  title: string;
  date: string;
  description?: string;
};

export async function createCalendarEvent(
  input: GcalEventInput,
): Promise<string | null> {
  if (!process.env.GOOGLE_CALENDAR_CLIENT_ID) {
    return null;
  }
  void input;
  return null;
}

export async function markCalendarEventDone(gcalEventId: string): Promise<void> {
  if (!gcalEventId || !process.env.GOOGLE_CALENDAR_CLIENT_ID) return;
  // Phase 2: タイトルに「【済】」を付与し、colorId を 8（グレー）へ更新する。
}

export async function updateCalendarEventDate(
  gcalEventId: string,
  date: string,
): Promise<void> {
  if (!gcalEventId || !process.env.GOOGLE_CALENDAR_CLIENT_ID) return;
  void date;
}
