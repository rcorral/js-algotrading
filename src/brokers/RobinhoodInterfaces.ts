export interface APIAuthenticationResponse {
  token?: string;
  mfa_type?: string;
  mfa_required?: string;
}

export interface APIQuoteInterface {
  ask_price: string; // "166.4400"
  ask_size: number; // 300
  bid_price: string; // "166.4300"
  bid_size: number; // 400
  last_trade_price: string; // "166.2900"
  last_extended_hours_trade_price: string; // "166.2900"
  previous_close: string; // "164.2100"
  adjusted_previous_close: string; // "164.2100"
  previous_close_date: string; // "2017-09-26"
  symbol: string; // "FB"
  trading_halted: boolean; // false
  has_traded: boolean; // true
  last_trade_price_source: string; // "nls"
  updated_at: string; // "2017-09-27T16:12:48Z"
  instrument: string; // /instruments/ebab2398-028d-4939-9f1d-13bf38f81c50/
}

export interface APIQuoteResponse {
  results: APIQuoteInterface[];
}

export const enum InstrumentTypes {
  stock = "stock",
  adr = "adr",
  etp = "etp"
}

export interface APIInstrumentResponse {
  min_tick_size: string;
  type: InstrumentTypes;
  splits: string; // "/instruments/50810c35-d215-9758-0ada4ac79ffa/splits/"
  margin_initial_ratio: string; // "0.5000"
  url: string; // "/instruments/50810c35-d215-4866-9758-0ada4ac79ffa/"
  quote: string; // "/quotes/MSFT/"
  tradability: "tradable" | "untradable";
  symbol: string; // "MSFT"
  bloomberg_unique: string; // "EQ0010174300001000"
  list_date: string; // "1987-09-17"
  fundamentals: string; // "/fundamentals/MSFT/"
  state: "active" | "innactive";
  country: string; // "US"
  day_trade_ratio: string; // "0.2500"
  tradeable: boolean;
  maintenance_ratio: string; // "0.2500";
  id: string; // "50810c35-d215-4866-9758-0ada4ac79ffa";
  market: string; // "/markets/XNAS/";
  name: string; // "Microsoft Corporation - Common Stock";
  simple_name: string | null; // 'Microsoft'
}

export interface APIInstrumentBySymbolResponse {
  previous: string;
  results: Array<APIInstrumentResponse>;
  next: string;
}

export interface APIFundamentalsResponse {
  open: string; // "18.9200"
  high: string; // "19.8400"
  low: string; // "18.3500"
  volume: string; // "137270.0000"
  average_volume_2_weeks: string; // "685061.1000"
  average_volume: string; // "792759.8207"
  high_52_weeks: string; // "30.5000"
  dividend_yield: string; // "30.2971"
  low_52_weeks: string; // "16.0600"
  market_cap: string; // "634006200.0000"
  pe_ratio: string; // "36.1367"
  shares_outstanding: string; // "33036518.5000"
  description: string;
  instrument: APIInstrumentResponse["url"];
  ceo: string;
  headquarters_city: string;
  headquarters_state: string;
  sector: string; // "Producer Manufacturing";
  num_employees: number;
  year_founded: number;
}

export interface APIAccountInterface {
  deactivated: boolean;
  updated_at: string; // "2017-07-17T05:29:19.742318Z"
  margin_balances: {
    day_trade_buying_power: string; // "3529.9575"
    start_of_day_overnight_buying_power: string; // "2195.3650"
    overnight_buying_power_held_for_orders: string; // "0.0000"
    cash_held_for_orders: string; // "0.0000"
    created_at: string; // "2017-05-25T13:45:06.120247Z"
    unsettled_debit: string; // "0.0000"
    start_of_day_dtbp: string; // "3529.9575"
    day_trade_buying_power_held_for_orders: string; // "0.0000"
    overnight_buying_power: string; // "2195.3650"
    marked_pattern_day_trader_date: string | false;
    cash: string; // "-1692.6900"
    unallocated_margin_cash: string; // "307.3100"
    updated_at: string; // "2017-09-27T11:09:22.167382Z"
    cash_available_for_withdrawal: string; // "307.3100"
    margin_limit: string; // "2000.0000"
    outstanding_interest: string; // "0.0000"
    uncleared_deposits: string; // "0.0000"
    unsettled_funds: string; // "0.0000"
    gold_equity_requirement: string; // "24000.0000"
    day_trade_ratio: string; // "0.25"
    overnight_ratio: string; // "0.50"
  };
  portfolio: string; // /accounts/ACCT_NUMB/portfolio/
  cash_balances: string | null;
  can_downgrade_to_cash: string; // /accounts/ACCT_NUMB/can_downgrade_to_cash/
  withdrawal_halted: boolean;
  cash_available_for_withdrawal: string; // "307.3100"
  type: string; // "margin"
  sma: string; // "2195.3650"
  sweep_enabled: boolean;
  deposit_halted: boolean;
  buying_power: string; // "2195.3650"
  user: string; // /user/
  max_ach_early_access_amount: string; // "2000.00"
  instant_eligibility: {
    updated_at: string | null; // "2017-05-25T13:45:06.113810Z"
    reason: string; // ""
    reinstatement_date: string | null; // "2017-05-25T13:45:06.113810Z"
    reversal: null;
    state: string; // "ok"
  };
  cash_held_for_orders: string; // "0.0000"
  only_position_closing_trades: boolean;
  url: string; // /accounts/ACCT_NUMB/
  positions: string; // /accounts/ACCT_NUMB/positions/
  created_at: string; // "2017-05-25T13:45:06.113810Z"
  cash: string; // "-1692.6900"
  sma_held_for_orders: string; // "0.0000"
  unsettled_debit: string; // "0.0000"
  account_number: string; // "ACCT_NUMB"
  uncleared_deposits: string; // "0.0000"
  unsettled_funds: string; // "0.0000"
}

export interface APIAccountResponse {
  previous: string;
  results: APIAccountInterface[];
  next: string;
}

export interface APIOrdersParameters {
  updated_at?: string;
  instrument?: string;
  cursor?: string;
}

export enum APIOrderState {
  queued = "queued",
  unconfirmed = "unconfirmed",
  confirmed = "confirmed", // It has been accepted
  partially_filled = "partially_filled",
  filled = "filled",
  rejected = "rejected",
  cancelled = "cancelled",
  canceled = "canceled",
  failed = "failed"
}

export enum APIOrderTimeInForce {
  gfd = "gfd", // Good for day
  gtc = "gtc", // Good till canceled
  ioc = "ioc",
  fok = "fok",
  opg = "opg"
}

export enum APIOrderType {
  market = "market",
  limit = "limit"
}

export enum APIOrderTrigger {
  immediate = "immediate",
  stop = "stop"
}

export enum APIOrderSide {
  buy = "buy",
  sell = "sell"
}

export interface APIOrderExcutionInterface {
  timestamp: string; // "2017-08-08T13:31:19.517000Z"
  price: string; // "71.80000000"
  settlement_date: string; // "2017-08-11"
  id: string; // "35561c1e-2ac9-4291-9c88-bc663c2001ee"
  quantity: string; // "4.00000"
}

interface APIOrderBaseInterface {
  account: string; // /accounts/5SE16159/
  instrument: string; // /instruments/FFFF-ccbf-4ef6-CCCC-99c8bc318dd0/
  time_in_force: APIOrderTimeInForce; // "gfd"
  quantity: string; // "22.00000"
  type: APIOrderType; // "market"
  trigger: APIOrderTrigger; // "immediate"
  side: APIOrderSide; // "buy"
  price?: null | string; // "23.68000000"
  stop_price?: null | string; // "23.68000000"
  extended_hours?: boolean; // Should trade after exchanges close?
  override_day_trade_checks?: boolean;
  override_dtbp_checks?: boolean;
}

// This is the interface that the API expects for order creation
export interface APIOrderCreateInterface extends APIOrderBaseInterface {
  symbol: string; // FB
  client_id?: string; // Only for OAuth applications
}

// This is the response from the API for each order
export interface APIOrderResponseInterface extends APIOrderBaseInterface {
  updated_at: string; // "2017-06-07T13:32:50.333096Z"
  ref_id: number; // null
  fees: string; // "0.00"
  cancel: string; // /cancel/foo-bar
  id: string; // "FFFFF-a6e3-46ee-CCCC-1821780005ab"
  cumulative_quantity: string; // "22.00000"
  reject_reason: string;
  state: APIOrderState; // "filled"
  last_transaction_at: string | null; // "2017-06-07T13:32:50.299000Z"
  executions: APIOrderExcutionInterface[];
  url: string; // /orders/FFFFF-a6e3-46ee-CCCC-1821780005ab/
  created_at: string; // "2017-06-07T06:18:31.634463Z"
  position: string; // /positions/ACCT_NUMB/FFFF-ccbf-4ef6-CCCC-99c8bc318dd0/
  average_price: string; // "22.78000000"
}

export interface APIOrdersResponse {
  previous: string;
  results: Array<APIOrderResponseInterface>;
  next: string;
}
