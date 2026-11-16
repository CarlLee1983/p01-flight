export interface Wave {
  at: number;
  x: number;
  speed: number;
  hp: number;
  points: number;
}
export interface StageConfig {
  id: string;
  title: string;
  duration: number;
  width: number;
  height: number;
  waves: Wave[];
}
export const stage01: StageConfig = {
  id: "stage-01",
  title: "雲際航線",
  duration: 75,
  width: 360,
  height: 640,
  waves: Array.from({ length: 48 }, (_, i) => ({
    at: 1.5 + i * 1.45,
    x: [70, 180, 290, 120, 240, 180][i % 6],
    speed: 95 + Math.floor(i / 12) * 15,
    hp: i % 4 === 0 ? 2 : 1,
    points: 100,
  })),
};
