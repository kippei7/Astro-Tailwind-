import { redirect } from "next/navigation";
import { createTaskEventAction } from "@/lib/actions";
import { safeInternalPath } from "@/lib/calendar";
import type { Area, TaskMaster, User } from "@/lib/types";
import { SubmitButton } from "./SubmitButton";

export function TaskEventForm({
  areas,
  masters,
  users,
  defaultDate,
  defaultUserId,
  showDate = true,
  redirectTo,
  compact = false,
  submitLabel = "予定を保存",
}: {
  areas: Area[];
  masters: TaskMaster[];
  users: User[];
  defaultDate: string;
  defaultUserId?: string;
  showDate?: boolean;
  redirectTo?: string;
  compact?: boolean;
  submitLabel?: string;
}) {
  async function create(formData: FormData) {
    "use server";
    await createTaskEventAction(formData);
    const date = String(formData.get("scheduled_date") ?? "");
    const next = safeInternalPath(String(formData.get("redirect_to") ?? ""));
    if (next) {
      redirect(next);
    }
    redirect(date ? `/tasks?month=${date.slice(0, 7)}&date=${date}` : "/tasks");
  }

  return (
    <form action={create} className={compact ? "cal-add-form" : "card space-y-4"}>
      {redirectTo ? <input type="hidden" name="redirect_to" value={redirectTo} /> : null}
      {showDate ? (
        <label className="field">
          <span>予定日</span>
          <input type="date" name="scheduled_date" required defaultValue={defaultDate} />
        </label>
      ) : (
        <input type="hidden" name="scheduled_date" value={defaultDate} />
      )}
      <label className="field cal-add-task">
        <span>タスク</span>
        <select name="task_id" required defaultValue="">
          <option value="" disabled>
            選択してください
          </option>
          {areas.map((area) => (
            <optgroup key={area.id} label={area.name}>
              {masters
                .filter((master) => master.area_id === area.id)
                .map((master) => (
                  <option key={master.id} value={master.id}>
                    {master.name}（{master.points}pt）
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="field">
        <span>担当</span>
        <select name="assigned_user_id" required defaultValue={defaultUserId ?? users[0]?.id}>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </label>
      <SubmitButton className={compact ? "btn-primary cal-add-submit" : "btn-primary w-full"} pendingLabel="作成中…">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
