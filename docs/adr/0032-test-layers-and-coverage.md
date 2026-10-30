# 32. Test layers and coverage thresholds

Vitest (Node) covers the engine, actions, migrations and Zod schemas, with CI requiring 95% branch coverage on those. Playwright screenshot comparisons cover canvas rendering; Playwright + axe cover user flows. No coverage threshold on UI code.
