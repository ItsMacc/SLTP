from enum import Enum

class EventType(Enum):
    STOP_LOSS = 'stop_loss'
    TAKE_PROFIT = 'take_profit'
    SIGNAL = 'signal'
    END_OF_BACKTEST = 'end_of_backtest'
