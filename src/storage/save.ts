export const SAVE_KEY = "p01-flight:save:v1";
export interface Save {
  saveVersion: 1;
  stages: Record<
    string,
    { cleared: boolean; bestScore: number; clearCount: number }
  >;
  settings: { musicVolume: number; sfxVolume: number };
}
const defaults = (): Save => ({
  saveVersion: 1,
  stages: {},
  settings: { musicVolume: 0.6, sfxVolume: 0.8 },
});
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export class BrowserSaveRepository {
  data = defaults();
  warning = "";
  constructor(private storage: StoragePort | null) {
    this.load();
  }
  private load() {
    try {
      if (!this.storage) throw Error();
      const raw = this.storage.getItem(SAVE_KEY);
      if (!raw) return;
      const v = JSON.parse(raw);
      if (
        !v ||
        v.saveVersion !== 1 ||
        !v.stages ||
        typeof v.stages !== "object" ||
        Array.isArray(v.stages) ||
        !v.settings
      )
        throw Error();
      for (const s of Object.values(v.stages) as any[]) {
        if (
          typeof s.cleared !== "boolean" ||
          !Number.isSafeInteger(s.bestScore) ||
          s.bestScore < 0 ||
          !Number.isSafeInteger(s.clearCount) ||
          s.clearCount < 0
        )
          throw Error();
      }
      for (const n of [v.settings.musicVolume, v.settings.sfxVolume])
        if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1)
          throw Error();
      this.data = v;
    } catch {
      this.warning = "本機紀錄無法讀取，已使用預設值；仍可遊玩。";
    }
  }
  private write() {
    try {
      if (!this.storage) throw Error();
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
      this.warning = "";
    } catch {
      this.warning = "本次紀錄未能保存；關閉頁面後可能遺失。";
    }
  }
  record(stage: string, score: number, won: boolean) {
    const old = this.data.stages[stage] ?? {
      cleared: false,
      bestScore: 0,
      clearCount: 0,
    };
    this.data.stages[stage] = {
      cleared: old.cleared || won,
      bestScore: Math.max(old.bestScore, score),
      clearCount: old.clearCount + (won ? 1 : 0),
    };
    this.write();
  }
  settings(music: number, sfx: number) {
    this.data.settings = { musicVolume: music, sfxVolume: sfx };
    this.write();
  }
  reset() {
    this.data = defaults();
    this.write();
  }
}
