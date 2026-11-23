import { env as privateEnv } from '$env/dynamic/private';
import type { Fixture, Prediction } from '#lib/types';
import { LEAGUE_MAP, TEAM_MAP } from '#lib/data/catalog';
import { getPrediction } from '#lib/engine/predictions';

export interface AnalysisSection {
  heading: string;
  body: string;
}

export interface AnalysisResult {
  provider: 'llm' | 'grounded-template';
  model: string;
  generatedAt: string;
  headline: string;
  summary: string;
  sections: AnalysisSection[];
  disclaimer: string;
}

const DISCLAIMER =
  'CaveBettor produces analysis, not guarantees. Probabilities are model estimates; variance is real. Stake only what you can afford to lose. 18+.';

function context(fixture: Fixture, prediction: Prediction): string {
  const home = TEAM_MAP[fixture.homeId];
  const away = TEAM_MAP[fixture.awayId];
  const league = LEAGUE_MAP[fixture.leagueId];
  const markets = prediction.markets
    .map((m) => `${m.label}: ${m.outcomes.map((o) => `${o.label} ${(o.modelProbability * 100).toFixed(1)}% @ ${o.bookOdds.toFixed(2)}`).join(', ')}`)
    .join('\n');
  return `Fixture: ${home.name} vs ${away.name}
Competition: ${league.name} (${league.country}), ${fixture.round}
Kickoff: ${fixture.kickoff}; status: ${fixture.status}; score: ${fixture.score.home}-${fixture.score.away}
Venue: ${fixture.venue}. Weather: ${fixture.weather}
Model ensemble: ${prediction.modelVersion}; confidence ${prediction.confidence}%; data quality ${(prediction.dataQuality * 100).toFixed(0)}%
Expected goals: ${prediction.expectedGoals.home} - ${prediction.expectedGoals.away} (total ${prediction.expectedGoals.total})
1X2: home ${(prediction.probabilities.home * 100).toFixed(1)}%, draw ${(prediction.probabilities.draw * 100).toFixed(1)}%, away ${(prediction.probabilities.away * 100).toFixed(1)}%
BTTS ${(prediction.bothTeamsScore * 100).toFixed(1)}%; over 2.5 ${(prediction.over25 * 100).toFixed(1)}%
Top scorelines: ${prediction.topScorelines.slice(0, 4).map((s) => `${s.home}-${s.away} ${(s.probability * 100).toFixed(1)}%`).join(', ')}
Recommended: ${prediction.recommended.selection} at ${prediction.recommended.odds} (${(prediction.recommended.modelProbability * 100).toFixed(1)}%), risk ${prediction.recommended.risk}
Markets:
${markets}`;
}

function deterministic(fixture: Fixture, prediction: Prediction): AnalysisResult {
  const home = TEAM_MAP[fixture.homeId];
  const away = TEAM_MAP[fixture.awayId];
  const favourite = prediction.probabilities.home >= prediction.probabilities.away ? home : away;
  const favouriteProb = Math.max(prediction.probabilities.home, prediction.probabilities.away);
  const best = prediction.valueBets[0];
  const drawPart = prediction.probabilities.draw > 0.01 ? `, a draw ${(prediction.probabilities.draw * 100).toFixed(1)}%` : '';
  const headline =
    prediction.edge >= 0.05
      ? `A ${(prediction.edge * 100).toFixed(1)}% edge is visible on ${best?.selection ?? prediction.recommended.selection}`
      : prediction.confidence >= 75
        ? `${favourite.name} are well supported, but the price is fair`
        : 'A tight, high-variance matchup with selective value';

  return {
    provider: 'grounded-template',
    model: 'CaveBettor grounded analyst (no LLM key configured)',
    generatedAt: new Date().toISOString(),
    headline,
    summary: `${home.shortName} host ${away.shortName} with the ensemble leaning ${favourite.shortName} at ${(favouriteProb * 100).toFixed(1)}%${drawPart}. Expected score ${prediction.expectedGoals.home.toFixed(2)}–${prediction.expectedGoals.away.toFixed(2)}, confidence ${prediction.confidence}%.`,
    sections: [
      {
        heading: 'The model view',
        body: `The Dixon–Coles and CaveBoost components are anchored by a vig-free market consensus. ${home.name} carry a ${home.form.join('')} recent sequence and ${home.xgFor.toFixed(2)} xG per match; ${away.name} arrive at ${away.form.join('')} with ${away.xgAgainst.toFixed(2)} xGA. The model's top scorelines are ${prediction.topScorelines.slice(0, 3).map((s) => `${s.home}–${s.away}`).join(', ')}.`
      },
      {
        heading: 'Where the value sits',
        body: best
          ? `${best.selection} in the ${best.market} is available at ${best.odds.toFixed(2)} with ${best.bookmaker}. The model prices it at ${(best.modelProbability * 100).toFixed(1)}%, an edge of ${(best.edge * 100).toFixed(1)}%. Quarter-Kelly on the ₦1.25m paper bankroll suggests ${Math.round(best.stakeNgn / 100) * 100 > 0 ? `₦${best.stakeNgn.toLocaleString('en-NG')}` : 'a minimum stake'}. If the price shortens below ${best.odds.toFixed(2)}, the edge disappears.`
          : `No selection currently clears the 2.5% edge threshold. ${prediction.recommended.selection} is the most likely outcome but the price is efficient. The disciplined play is to wait for a better number or pass.`
      },
      {
        heading: 'Risk and conditions',
        body: `Confidence is ${prediction.confidence}% with data quality at ${(prediction.dataQuality * 100).toFixed(0)}%. ${fixture.weather ? `Conditions: ${fixture.weather}.` : ''} ${prediction.probabilities.draw > 0.26 ? 'The draw is live and reduces the appeal of single-match win bets. ' : ''}The largest model disagreement is between the sequence component and the market prior — treat the edge as provisional until team news is confirmed.`
      }
    ],
    disclaimer: DISCLAIMER
  };
}

export async function generateAnalysis(fixture: Fixture, prediction = getPrediction(fixture)): Promise<AnalysisResult> {
  const fallback = deterministic(fixture, prediction);
  const agnesKey = privateEnv.AGNES_AI_KEY || process.env.AGNES_AI_KEY;
  const openaiKey = privateEnv.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const apiKey = agnesKey || openaiKey;
  if (!apiKey) return fallback;
  const baseUrl = agnesKey
    ? privateEnv.AGNES_API_BASE_URL || process.env.AGNES_API_BASE_URL || 'https://apihub.agnes-ai.com/v1'
    : 'https://api.openai.com/v1';
  const model = agnesKey
    ? privateEnv.AGNES_MODEL || process.env.AGNES_MODEL || 'agnes-3.0-flash'
    : privateEnv.OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are CaveBettor’s match analyst. Use ONLY the numeric context supplied. Never invent probabilities, players, injuries or odds. Write concise, plain English for a professional bettor. Return JSON with keys headline (string), summary (string), sections (array of {heading, body}, exactly 3). Emphasise value, risk and what would invalidate the read. Do not promise winnings.'
          },
          { role: 'user', content: context(fixture, prediction) }
        ]
      })
    });
    if (!res.ok) return fallback;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return fallback;
    const parsed = JSON.parse(content) as { headline?: string; summary?: string; sections?: AnalysisSection[] };
    if (!parsed.headline || !parsed.summary || !Array.isArray(parsed.sections)) return fallback;
    return {
      provider: 'llm',
      model,
      generatedAt: new Date().toISOString(),
      headline: parsed.headline,
      summary: parsed.summary,
      sections: parsed.sections.slice(0, 3),
      disclaimer: DISCLAIMER
    };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}
