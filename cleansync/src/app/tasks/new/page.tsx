import { redirect } from "next/navigation";
import { createTaskEventAction } from "@/lib/actions";
import { todayYmd } from "@/lib/dates";
import { getStore } from "@/lib/store";
import { SubmitButton } from "@/components/SubmitButton";

export default async function NewTaskPage() {
  const store = await getStore();

  async function create(formData: FormData) {
    "use server";
    await createTaskEventAction(formData);
    redirect("/tasks");
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <p className="page-kicker">NEW EVENT</p>
        <h1 className="page-title">予定を追加</h1>
        <p className="page-lead">
          タスク定義から選んで、担当者と日付を決めるだけです。手順は定義側に残します。
        </p>
      </header>

      <form action={create} className="card space-y-4">
        <label className="field">
          <span>タスク</span>
          <select name="task_id" required defaultValue="">
            <option value="" disabled>
              選択してください
            </option>
            {store.areas.map((area) => (
              <optgroup key={area.id} label={area.name}>
                {store.task_master
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
          <select name="assigned_user_id" required>
            {store.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>予定日</span>
          <input type="date" name="scheduled_date" required defaultValue={todayYmd()} />
        </label>
        <SubmitButton className="btn-primary w-full" pendingLabel="作成中…">
          予定を保存
        </SubmitButton>
      </form>
    </div>
  );
}
