import { redirect } from "next/navigation";
import {
  createAreaAction,
  createMasterAction,
  deleteAreaAction,
  deleteMasterAction,
  updateAreaAction,
  updateMasterAction,
} from "@/lib/actions";
import { getStore } from "@/lib/store";
import { SubmitButton } from "@/components/SubmitButton";

export default async function MastersPage() {
  const store = await getStore();

  async function createMaster(formData: FormData) {
    "use server";
    await createMasterAction(formData);
    redirect("/masters");
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="page-kicker">TASK MASTER</p>
        <h1 className="page-title">タスク定義</h1>
        <p className="page-lead">
          エリア・手順・ポイント・リスケ規則を先に決めておくと、予定作成が早く、やり方も属人化しません。
        </p>
      </header>

      <section className="grid-2">
        <div className="card space-y-4">
          <h2 className="font-display text-2xl">エリア</h2>
          <form action={createAreaAction} className="flex gap-2">
            <input
              name="name"
              required
              placeholder="例: ベランダ"
              className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white px-3 py-2"
            />
            <SubmitButton className="btn-secondary">追加</SubmitButton>
          </form>
          <ul className="space-y-3">
            {store.areas.map((area) => (
              <li key={area.id} className="rounded-2xl border border-[var(--line)] p-3">
                <form action={updateAreaAction.bind(null, area.id)} className="flex gap-2">
                  <input
                    name="name"
                    defaultValue={area.name}
                    className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white px-3 py-2"
                  />
                  <SubmitButton className="btn-ghost">保存</SubmitButton>
                </form>
                {store.task_master.some((item) => item.area_id === area.id) ? null : (
                  <form action={deleteAreaAction.bind(null, area.id)}>
                    <SubmitButton className="btn-danger mt-1 text-xs">削除</SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </div>

        <form action={createMaster} className="card space-y-4">
          <h2 className="font-display text-2xl">新しい定義</h2>
          <label className="field">
            <span>エリア</span>
            <select name="area_id" required>
              {store.areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>タスク名</span>
            <input name="name" required placeholder="例: 窓拭き" />
          </label>
          <label className="field">
            <span>手順メモ</span>
            <textarea name="description" placeholder="掃除のやり方" />
          </label>
          <label className="field">
            <span>ポイント</span>
            <input name="points" type="number" min={1} max={100} defaultValue={10} required />
          </label>
          <label className="field">
            <span>リスケ規則</span>
            <select name="reschedule_rule" defaultValue="NEXT_DAY">
              <option value="NEXT_DAY">翌日へ送る</option>
              <option value="NEXT_WEEKEND">次の週末へ送る</option>
            </select>
          </label>
          <SubmitButton className="btn-primary w-full">定義を追加</SubmitButton>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">定義一覧</h2>
        {store.task_master.map((master) => {
          const area = store.areas.find((item) => item.id === master.area_id);
          return (
            <article key={master.id} className="card space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-[var(--muted)]">{area?.name}</p>
                  <h3 className="font-display text-xl">{master.name}</h3>
                </div>
                <p className="font-display text-2xl tabular-nums">
                  {master.points}
                  <span className="ml-1 text-sm text-[var(--muted)]">pt</span>
                </p>
              </div>
              <form action={updateMasterAction.bind(null, master.id)} className="grid gap-3 sm:grid-cols-2">
                <label className="field sm:col-span-2">
                  <span>タスク名</span>
                  <input name="name" defaultValue={master.name} />
                </label>
                <label className="field">
                  <span>エリア</span>
                  <select name="area_id" defaultValue={master.area_id}>
                    {store.areas.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>ポイント</span>
                  <input name="points" type="number" min={1} defaultValue={master.points} />
                </label>
                <label className="field">
                  <span>リスケ規則</span>
                  <select name="reschedule_rule" defaultValue={master.reschedule_rule}>
                    <option value="NEXT_DAY">翌日</option>
                    <option value="NEXT_WEEKEND">次の週末</option>
                  </select>
                </label>
                <label className="field sm:col-span-2">
                  <span>手順</span>
                  <textarea name="description" defaultValue={master.description} />
                </label>
                <div className="flex gap-2 sm:col-span-2">
                  <SubmitButton className="btn-secondary">保存</SubmitButton>
                </div>
              </form>
              {store.task_events.some((item) => item.task_id === master.id) ? null : (
                <form action={deleteMasterAction.bind(null, master.id)}>
                  <SubmitButton className="btn-danger">この定義を削除</SubmitButton>
                </form>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
