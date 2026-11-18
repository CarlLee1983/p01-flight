import type { Page } from "@playwright/test";
import { SAVE_KEY } from "../../src/storage/save";
export async function chooseThirdFront(page: Page, secondCleared = true) {
  await page.addInitScript(
    ({ key, secondCleared }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(
          key,
          JSON.stringify({
            saveVersion: 1,
            stages: {
              "stage-01": { cleared: true, bestScore: 2000, clearCount: 1 },
              ...(secondCleared
                ? {
                    "stage-02": {
                      cleared: true,
                      bestScore: 5000,
                      clearCount: 1,
                    },
                  }
                : {}),
            },
            settings: { musicVolume: 0, sfxVolume: 0 },
          }),
        );
    },
    { key: SAVE_KEY, secondCleared },
  );
  await page.goto("/?seed=42");
  await page
    .locator("#stage-select")
    .selectOption(secondCleared ? "stage-03" : "stage-02");
}
