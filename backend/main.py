import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import indices, sectors, signals, stocks, news
from routers import symbols as symbols_router
from routers import settings as settings_router
from routers import backtest as backtest_router
from routers import trade_log as trade_log_router
from routers import crypto as crypto_router
from routers import paper_trading as paper_router
from routers.ws import router as ws_router, broadcast_loop
from services.market_data import start_background_refresh
from services.position_monitor import start_position_monitor
from services.trade_log import init_db
from services.paper_trading import init_paper_db

logging.basicConfig(
  level=logging.INFO,
  format='%(asctime)s [%(levelname)s] %(name)s — %(message)s',
  datefmt='%H:%M:%S',
)
# yfinance / urllib3 の冗長なログを抑制
logging.getLogger('yfinance').setLevel(logging.ERROR)
logging.getLogger('urllib3').setLevel(logging.WARNING)
logging.getLogger('peewee').setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI):
  init_db()
  init_paper_db()
  await start_background_refresh()
  asyncio.create_task(broadcast_loop())
  await start_position_monitor()
  yield


app = FastAPI(title='Nexus Trade API', version='0.4.0', lifespan=lifespan)

app.add_middleware(
  CORSMiddleware,
  allow_origins=['http://localhost:3000'],
  allow_methods=['GET', 'POST', 'DELETE', 'PATCH'],
  allow_headers=['*'],
)

app.include_router(indices.router,          prefix='/api/v1/indices',  tags=['indices'])
app.include_router(sectors.router,          prefix='/api/v1/sectors',  tags=['sectors'])
app.include_router(signals.router,          prefix='/api/v1/signals',  tags=['signals'])
app.include_router(stocks.router,           prefix='/api/v1/stocks',   tags=['stocks'])
app.include_router(news.router,             prefix='/api/v1/news',     tags=['news'])
app.include_router(symbols_router.router,   prefix='/api/v1/symbols',   tags=['symbols'])
app.include_router(settings_router.router,  prefix='/api/v1/settings',  tags=['settings'])
app.include_router(backtest_router.router,   prefix='/api/v1/backtest',   tags=['backtest'])
app.include_router(trade_log_router.router, prefix='/api/v1/trade-log', tags=['trade-log'])
app.include_router(crypto_router.router,    prefix='/api/v1/crypto',   tags=['crypto'])
app.include_router(paper_router.router,     prefix='/api/v1/paper',    tags=['paper-trading'])
app.include_router(ws_router,               tags=['websocket'])


@app.get('/health')
def health():
  return {'status': 'ok'}
