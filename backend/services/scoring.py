"""シグナルスコアリング & エントリータイミング判定 (Step 4)。

スコア構成 (合計 0–100):
  RSI        0–25 点
  MACD       0–25 点
  VWAP乖離   0–25 点
  MA整列     0–25 点
"""


def calc_score(
  rsi: float,
  macd_val: float,
  macd_sig: float,
  vwap_dev: float,
  close: float,
  ma5: float,
  ma25: float,
  ma75: float,
) -> int:
  score = 0

  # --- RSI (0–25) ---
  if rsi <= 30:
    score += 25
  elif rsi <= 40:
    score += int(20 + (40 - rsi) * 0.5)
  elif rsi <= 50:
    score += int(12 + (50 - rsi) * 0.8)
  elif rsi <= 60:
    score += int(6 + (60 - rsi) * 0.6)
  elif rsi <= 70:
    score += int((70 - rsi) * 0.6)
  # rsi > 70 → 0

  # --- MACD (0–25) ---
  hist = macd_val - macd_sig
  if macd_val > 0 and hist > 0:
    score += 25
  elif macd_val > 0 and hist <= 0:
    score += 15
  elif macd_val <= 0 and hist > 0:
    score += 10
  # macd_val <= 0 and hist <= 0 → 0

  # --- VWAP乖離 (0–25) ---
  if vwap_dev >= 2.0:
    score += 25
  elif vwap_dev >= 1.0:
    score += 20
  elif vwap_dev >= 0:
    score += 15
  elif vwap_dev >= -1.0:
    score += 8
  elif vwap_dev >= -2.0:
    score += 3
  # vwap_dev < -2.0 → 0

  # --- MA整列 (0–25) ---
  if close > ma5 and ma5 > ma25 and ma25 > ma75:
    score += 25
  elif close > ma5 and ma5 > ma25:
    score += 18
  elif close > ma5:
    score += 12
  elif close > ma25:
    score += 8
  elif close > ma75:
    score += 4
  # close < ma75 → 0

  return max(0, min(100, score))


def get_signal_label(score: int) -> str:
  if score >= 80: return 'Strong Buy'
  if score >= 60: return 'Buy'
  if score >= 40: return 'Hold'
  if score >= 20: return 'Sell'
  return 'Strong Sell'


def get_timing(score: int, macd_positive: bool, market: str) -> str:
  if market == 'US':
    if score >= 80: return 'NY寄り付き直後'
    if score >= 65 and macd_positive: return 'NY前場'
    if score >= 50: return 'NY様子見'
    if score >= 30: return 'NY大引け前'
    return 'ショート推奨'
  # JP
  if score >= 80: return '寄り付き直後'
  if score >= 65 and macd_positive: return '前場中盤'
  if score >= 50: return '前場'
  if score >= 40: return '様子見'
  if score >= 25: return '大引け前'
  return '売り推奨'


def build_timing_advice(
  ticker: str,
  signal: str,
  score: int,
  rsi: float,
  macd_positive: bool,
  vwap_dev: float,
  close: float,
  ma5: float,
  ma25: float,
  ma75: float,
  market: str,
) -> str:
  lines: list[str] = []
  signal_jp = {
    'Strong Buy': '強い買い', 'Buy': '買い',
    'Hold': '様子見', 'Sell': '売り', 'Strong Sell': '強い売り',
  }.get(signal, signal)

  lines.append(f'【シグナル】{signal_jp}  (スコア: {score}/100)')
  lines.append('')

  # RSI
  if rsi <= 30:
    lines.append(f'▲ RSI {rsi:.1f}: 売られすぎ — 反発の可能性大')
  elif rsi >= 70:
    lines.append(f'▼ RSI {rsi:.1f}: 買われすぎ — 調整リスクに注意')
  else:
    lines.append(f'→ RSI {rsi:.1f}: 中立水準')

  # MACD
  lines.append('▲ MACD: 正転 — 上昇モメンタム継続' if macd_positive else '▼ MACD: 負転 — 下降トレンド')

  # VWAP
  if vwap_dev >= 1:
    lines.append(f'▲ VWAPかい離: +{vwap_dev:.1f}% — VWAP上方で強気')
  elif vwap_dev <= -1:
    lines.append(f'▼ VWAPかい離: {vwap_dev:.1f}% — VWAP下方で弱気')
  else:
    lines.append(f'→ VWAPかい離: {vwap_dev:+.1f}% — VWAP付近')

  # MA整列
  if close > ma5 > ma25 > ma75:
    lines.append('▲ 移動平均: 完全順列 — 強いアップトレンド')
  elif close < ma5 < ma25 < ma75:
    lines.append('▼ 移動平均: 完全逆列 — 強いダウントレンド')
  else:
    lines.append('→ 移動平均: 混在 — トレンド転換の可能性')

  lines.append('')

  # エントリー推奨
  if market == 'JP':
    if score >= 75:
      lines.append('【推奨エントリー】寄り付き直後 (9:00〜9:30)')
      lines.append('勢いが最も強い時間帯。寄り付きの方向を確認してからエントリー。')
    elif score >= 60:
      lines.append('【推奨エントリー】前場中盤 (10:00〜11:00)')
      lines.append('寄り付きの勢いが落ち着いた後の押し目を狙う。')
    elif score <= 30:
      lines.append('【推奨エントリー】大引け前 (14:30〜15:30) — 売りポジション')
      lines.append('トレンド確認後にショートエントリー。翌日も継続する可能性あり。')
    else:
      lines.append('【推奨エントリー】様子見')
      lines.append('明確なシグナルが出るまでポジションを持たない。')
  else:
    if score >= 75:
      lines.append('【推奨エントリー】NY寄り付き直後 (日本時間 23:30〜0:00)')
    elif score >= 60:
      lines.append('【推奨エントリー】NY前場 (日本時間 0:00〜2:00)')
    elif score <= 30:
      lines.append('【推奨エントリー】ショートポジション検討 (NY前場〜中盤)')
    else:
      lines.append('【推奨エントリー】様子見')

  return '\n'.join(lines)
