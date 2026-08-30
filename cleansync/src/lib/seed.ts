import { todayYmd } from "./dates";
import { eventPoints } from "./points";
import { emptyGoogleAccount, type StoreData } from "./types";

const USER_HUSBAND = "usr-husband";
const USER_WIFE = "usr-wife";

const AREA_DRUM = "area-drum";
const AREA_BATH = "area-bath";
const AREA_LIVING = "area-living";
const AREA_KITCHEN = "area-kitchen";
const AREA_TOILET = "area-toilet";
const AREA_ENTRY = "area-entry";

const TM = {
  filter: "tm-drum-filter",
  tub: "tm-drum-tub",
  bathFloor: "tm-bath-floor",
  bathMirror: "tm-bath-mirror",
  vacuum: "tm-living-vacuum",
  wipe: "tm-living-wipe",
  sink: "tm-kitchen-sink",
  fan: "tm-kitchen-fan",
  toilet: "tm-toilet-bowl",
  entry: "tm-entry-floor",
} as const;

export function createSeed(now = new Date()): StoreData {
  const today = todayYmd(now);
  const yesterday = shiftDay(today, -1);
  const past = (daysAgo: number) => shiftDay(today, -daysAgo);

  const store: StoreData = {
    users: [
      { id: USER_HUSBAND, name: "夫", total_points: 0, color: "#2a9d8f" },
      { id: USER_WIFE, name: "妻", total_points: 0, color: "#c46b4a" },
    ],
    areas: [
      { id: AREA_DRUM, name: "ドラム式" },
      { id: AREA_BATH, name: "お風呂" },
      { id: AREA_LIVING, name: "リビング" },
      { id: AREA_KITCHEN, name: "キッチン" },
      { id: AREA_TOILET, name: "トイレ" },
      { id: AREA_ENTRY, name: "玄関" },
    ],
    task_master: [
      {
        id: TM.filter,
        area_id: AREA_DRUM,
        name: "乾燥フィルター清掃",
        description:
          "乾燥フィルターを手前に引き出す。糸くずを捨て、フィルターを水洗いして陰干しする。戻す前にパッキン周りも拭く。",
        points: 10,
        reschedule_rule: "NEXT_DAY",
      },
      {
        id: TM.tub,
        area_id: AREA_DRUM,
        name: "洗濯槽掃除",
        description:
          "洗濯槽クリーナーを投入し、コースを実行。終了後に槽のゴムパッキンと投入口を拭き取る。",
        points: 25,
        reschedule_rule: "NEXT_WEEKEND",
      },
      {
        id: TM.bathFloor,
        area_id: AREA_BATH,
        name: "床と排水口の掃除",
        description:
          "髪の毛を排水口ネットから取り、床を浴室洗剤でこすり洗い。最後にシャワーで流して水切りする。",
        points: 20,
        reschedule_rule: "NEXT_DAY",
      },
      {
        id: TM.bathMirror,
        area_id: AREA_BATH,
        name: "鏡と壁の水垢取り",
        description:
          "クエン酸スプレーを鏡と壁に吹き、数分置いてからスポンジで拭く。仕上げに乾いたタオルで水気を取る。",
        points: 18,
        reschedule_rule: "NEXT_WEEKEND",
      },
      {
        id: TM.vacuum,
        area_id: AREA_LIVING,
        name: "掃除機がけ",
        description:
          "床のおもちゃをどかし、端から中央へ掃除機。ソファ下とラグ裏も忘れずに。",
        points: 12,
        reschedule_rule: "NEXT_DAY",
      },
      {
        id: TM.wipe,
        area_id: AREA_LIVING,
        name: "拭き掃除",
        description:
          "テーブル・棚・スイッチ周りをウェットシートで拭く。リモコンとドアノブも消毒する。",
        points: 15,
        reschedule_rule: "NEXT_WEEKEND",
      },
      {
        id: TM.sink,
        area_id: AREA_KITCHEN,
        name: "シンク磨き",
        description:
          "食器を下げ、シンクと水栓を中性洗剤で磨く。排水口ネットを捨て、水切りカゴを洗う。",
        points: 14,
        reschedule_rule: "NEXT_DAY",
      },
      {
        id: TM.fan,
        area_id: AREA_KITCHEN,
        name: "換気扇フィルター",
        description:
          "フィルターを外して中性洗剤につけ置き。油汚れをスポンジで落とし、乾かして戻す。",
        points: 22,
        reschedule_rule: "NEXT_WEEKEND",
      },
      {
        id: TM.toilet,
        area_id: AREA_TOILET,
        name: "便器と床の掃除",
        description:
          "便器に洗浄剤を吹き、ブラシでこする。床・便座裏・レバーを除菌シートで拭く。",
        points: 16,
        reschedule_rule: "NEXT_DAY",
      },
      {
        id: TM.entry,
        area_id: AREA_ENTRY,
        name: "靴と床の整頓",
        description:
          "靴を揃えて棚へ。土間を掃除機→ウェットシート。傘立ての水気を拭き取る。",
        points: 8,
        reschedule_rule: "NEXT_WEEKEND",
      },
    ],
    task_events: [
      done("ev-01", TM.vacuum, USER_HUSBAND, past(24)),
      done("ev-02", TM.bathFloor, USER_WIFE, past(25)),
      done("ev-03", TM.wipe, USER_WIFE, past(22)),
      done("ev-04", TM.filter, USER_HUSBAND, past(19)),
      done("ev-05", TM.fan, USER_WIFE, past(18)),
      done("ev-06", TM.tub, USER_HUSBAND, past(15)),
      done("ev-07", TM.bathMirror, USER_WIFE, past(13)),
      done("ev-08", TM.sink, USER_HUSBAND, past(11)),
      done("ev-09", TM.filter, USER_WIFE, past(9)),
      done("ev-10", TM.toilet, USER_HUSBAND, past(7)),
      done("ev-11", TM.bathFloor, USER_WIFE, past(6)),
      done("ev-12", TM.vacuum, USER_HUSBAND, past(4)),
      done("ev-13", TM.entry, USER_WIFE, past(2)),
      {
        id: "ev-overdue-toilet",
        task_id: TM.toilet,
        assigned_user_id: USER_WIFE,
        scheduled_date: yesterday,
        completed_at: null,
        status: "TODO",
        gcal_event_id: null,
        reschedule_count: 1,
      },
      {
        id: "ev-alert-tub",
        task_id: TM.tub,
        assigned_user_id: USER_HUSBAND,
        scheduled_date: shiftDay(today, -5),
        completed_at: null,
        status: "TODO",
        gcal_event_id: null,
        reschedule_count: 3,
      },
      {
        id: "ev-today-filter",
        task_id: TM.filter,
        assigned_user_id: USER_HUSBAND,
        scheduled_date: today,
        completed_at: null,
        status: "TODO",
        gcal_event_id: null,
        reschedule_count: 0,
      },
      {
        id: "ev-today-sink",
        task_id: TM.sink,
        assigned_user_id: USER_WIFE,
        scheduled_date: today,
        completed_at: null,
        status: "TODO",
        gcal_event_id: null,
        reschedule_count: 0,
      },
      {
        id: "ev-today-vacuum",
        task_id: TM.vacuum,
        assigned_user_id: USER_HUSBAND,
        scheduled_date: today,
        completed_at: null,
        status: "TODO",
        gcal_event_id: null,
        reschedule_count: 0,
      },
    ],
    google: emptyGoogleAccount(),
  };

  for (const user of store.users) {
    user.total_points = store.task_events.reduce((sum, event) => {
      if (event.assigned_user_id !== user.id) return sum;
      const master = store.task_master.find((m) => m.id === event.task_id);
      if (!master) return sum;
      return sum + eventPoints(event, master);
    }, 0);
  }

  return store;
}

function done(
  id: string,
  taskId: string,
  userId: string,
  date: string,
): StoreData["task_events"][number] {
  return {
    id,
    task_id: taskId,
    assigned_user_id: userId,
    scheduled_date: date,
    completed_at: `${date}T11:30:00.000Z`,
    status: "DONE",
    gcal_event_id: null,
    reschedule_count: 0,
  };
}

function shiftDay(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + delta));
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${mm}-${dd}`;
}
