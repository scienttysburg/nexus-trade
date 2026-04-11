JP_WATCHLIST: list[str] = [
  '7203.T',  # トヨタ自動車
  '6758.T',  # ソニーグループ
  '8306.T',  # 三菱UFJフィナンシャル
  '9432.T',  # 日本電信電話
  '4063.T',  # 信越化学工業
  '6861.T',  # キーエンス
  '8035.T',  # 東京エレクトロン
  '7974.T',  # 任天堂
  '4519.T',  # 中外製薬
  '2802.T',  # 味の素
  '8766.T',  # 東京海上HD
  '6367.T',  # ダイキン工業
  '7741.T',  # HOYA
  '4568.T',  # 第一三共
  '8058.T',  # 三菱商事
  '6857.T',  # アドバンテスト
  '8316.T',  # 三井住友FG
  '5020.T',  # ENEOSホールディングス
  '9984.T',  # ソフトバンクグループ
  '3382.T',  # セブン&アイHD
  '7267.T',  # ホンダ
  '4188.T',  # 三菱ケミカル
  '8801.T',  # 三井不動産
  '2914.T',  # JT
  '1605.T',  # INPEX
  '7453.T',  # 良品計画
]

US_WATCHLIST: list[str] = [
  'NVDA', 'AAPL', 'MSFT', 'AMZN', 'TSLA',
  'GOOGL', 'META', 'AMD', 'AVGO', 'JPM',
  'V', 'WMT', 'UNH', 'MA', 'XOM',
]

WATCHLIST = JP_WATCHLIST + US_WATCHLIST

TICKER_NAME: dict[str, str] = {
  '7203.T': 'トヨタ自動車',
  '6758.T': 'ソニーグループ',
  '8306.T': '三菱UFJフィナンシャル',
  '9432.T': '日本電信電話',
  '4063.T': '信越化学工業',
  '6861.T': 'キーエンス',
  '8035.T': '東京エレクトロン',
  '7974.T': '任天堂',
  '4519.T': '中外製薬',
  '2802.T': '味の素',
  '8766.T': '東京海上HD',
  '6367.T': 'ダイキン工業',
  '7741.T': 'HOYA',
  '4568.T': '第一三共',
  '8058.T': '三菱商事',
  '6857.T': 'アドバンテスト',
  '8316.T': '三井住友FG',
  '5020.T': 'ENEOSホールディングス',
  '9984.T': 'ソフトバンクグループ',
  '3382.T': 'セブン&アイHD',
  '7267.T': 'ホンダ',
  '4188.T': '三菱ケミカル',
  '8801.T': '三井不動産',
  '2914.T': 'JT',
  '1605.T': 'INPEX',
  '7453.T': '良品計画',
  'NVDA':  'NVIDIA',
  'AAPL':  'Apple',
  'MSFT':  'Microsoft',
  'AMZN':  'Amazon',
  'TSLA':  'Tesla',
  'GOOGL': 'Alphabet',
  'META':  'Meta Platforms',
  'AMD':   'Advanced Micro Devices',
  'AVGO':  'Broadcom',
  'JPM':   'JPMorgan Chase',
  'V':     'Visa',
  'WMT':   'Walmart',
  'UNH':   'UnitedHealth',
  'MA':    'Mastercard',
  'XOM':   'ExxonMobil',
}

TICKER_SECTOR: dict[str, str] = {
  '7203.T': '自動車・輸送機器',
  '7267.T': '自動車・輸送機器',
  '6758.T': '電機',
  '8306.T': '銀行・金融',
  '8316.T': '銀行・金融',
  '8766.T': '銀行・金融',
  '9432.T': '情報通信',
  '9984.T': '情報通信',
  '4063.T': '化学',
  '4188.T': '化学',
  '6861.T': '電子機器',
  '8035.T': '半導体・電子部品',
  '6857.T': '半導体・電子部品',
  '7974.T': 'ゲーム・エンタメ',
  '4519.T': '医薬品・ヘルスケア',
  '4568.T': '医薬品・ヘルスケア',
  '2802.T': '食品・飲料',
  '2914.T': '食品・飲料',
  '6367.T': '機械・製造',
  '7741.T': '精密機器',
  '8058.T': '商社',
  '5020.T': 'エネルギー・資源',
  '1605.T': 'エネルギー・資源',
  '8801.T': '不動産',
  '3382.T': '小売・消費財',
  '7453.T': '小売・消費財',
  'NVDA':  '半導体・電子部品',
  'AMD':   '半導体・電子部品',
  'AVGO':  '半導体・電子部品',
  'AAPL':  'テクノロジー',
  'MSFT':  'テクノロジー',
  'GOOGL': 'テクノロジー',
  'META':  'SNS・メディア',
  'AMZN':  'eコマース',
  'TSLA':  'EV・自動車',
  'JPM':   '銀行・金融',
  'V':     '決済・金融',
  'MA':    '決済・金融',
  'WMT':   '小売・消費財',
  'UNH':   '医薬品・ヘルスケア',
  'XOM':   'エネルギー・資源',
}

# yfinance ティッカー → 表示名・市場
INDEX_TICKERS: dict[str, str] = {
  'N225': '^N225',
  'SPX':  '^GSPC',
  'NDX':  '^NDX',
  'DJI':  '^DJI',
}

INDEX_DISPLAY: dict[str, dict] = {
  'N225': {'name': '日経225',     'market': 'JP'},
  'SPX':  {'name': 'S&P 500',    'market': 'US'},
  'NDX':  {'name': 'NASDAQ 100', 'market': 'US'},
  'DJI':  {'name': 'NYダウ',     'market': 'US'},
}

# セクター表示コード（フロントエンドのヒートマップに使用）
SECTOR_CODE: dict[str, str] = {
  '半導体・電子部品': 'semiconductor',
  '銀行・金融':       'banking',
  '自動車・輸送機器': 'automotive',
  '電機':             'electronics',
  '医薬品・ヘルスケア': 'pharma',
  '情報通信':         'telecom',
  '電子機器':         'instruments',
  '食品・飲料':       'food',
  '機械・製造':       'machinery',
  '精密機器':         'precision',
  '商社':             'trading',
  '不動産':           'realestate',
  'エネルギー・資源': 'energy',
  '化学':             'chemicals',
  '小売・消費財':     'retail',
  'テクノロジー':     'tech',
  'SNS・メディア':    'media',
  'eコマース':        'ecommerce',
  'EV・自動車':       'ev',
  '決済・金融':       'fintech',
  'ゲーム・エンタメ': 'gaming',
}
