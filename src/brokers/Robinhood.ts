import EventEmitter = require("events");
import request = require("request");
import requestPromise = require("request-promise-native");
import requestPromiseErrors = require("request-promise-native/errors");

import {
  APIAuthenticationResponse,
  APIAccountInterface,
  APIAccountResponse,
  APIInstrumentResponse,
  APIInstrumentBySymbolResponse,
  APIOrderState,
  APIOrderTimeInForce,
  APIOrderType,
  APIOrderTrigger,
  APIOrderSide,
  APIOrderCreateInterface,
  APIOrderResponseInterface,
  APIOrdersParameters,
  APIOrdersResponse,
  APIQuoteResponse,
  APIFundamentalsResponse
} from "./RobinhoodInterfaces";
import { API_URL, ENDPOINTS } from "./RobinhoodAPIConfiguration";

interface RobinhoodCredentials {
  username: string;
  password: string;
}

interface RobinhoodConstructorOptions {
  credentials: RobinhoodCredentials;
  authToken?: string;
}

interface OrderBaseInterface {
  instrument: APIOrderCreateInterface["instrument"];
  quantity: APIOrderCreateInterface["quantity"];
  symbol: APIOrderCreateInterface["symbol"];
  side?: APIOrderCreateInterface["side"];
  time_in_force?: APIOrderCreateInterface["time_in_force"];
  trigger?: APIOrderCreateInterface["trigger"];
  type?: APIOrderCreateInterface["type"];
  extended_hours?: APIOrderCreateInterface["extended_hours"];
}

export interface OrderMarketInterface extends OrderBaseInterface {
  // All orders require a price property even for market orders
  // For type=market orders, set the price to 5% +/- depending if it's buy/sell
  price: string; // "23.68000000"
}

export interface OrderLimitInterface extends OrderBaseInterface {
  price: string; // "23.68000000"
}

export interface OrderStopMarketInterface extends OrderBaseInterface {
  stop_price: string; // "22.00000"
  // Price will be automatically set by Robinhood once
  // the stop order becomes a market order
  price: null;
}

export interface OrderStopLimitInterface extends OrderLimitInterface {
  stop_price: string; // "22.00000"
}

interface RobinhoodError {
  type: ERRORS;
  message: string;
}

const REVALIDATE_TOKEN_TIMEOUT = 1000 * 60 * 5; // 5 minutes

const DEFAULT_HEADERS = {
  Accept: "*/*",
  "Accept-Encoding": "gzip, deflate",
  "Accept-Language": "en;q=1, fr;q=0.9, de;q=0.8, ja;q=0.7, nl;q=0.6, it;q=0.5",
  "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
  Connection: "keep-alive",
  "X-Robinhood-API-Version": "1.152.0",
  "User-Agent":
    "Robinhood/5.32.0 (com.robinhood.release.Robinhood; build:3814; iOS 10.3.3)"
};

export const enum ERRORS {
  AUTHENTICATION = "AUTHENTICATION",
  AUTHENTICATION_MFA = "AUTHENTICATION_MFA",
  INVALID_ROBINHOOD_CONFIGURATION = "INVALID_ROBINHOOD_CONFIGURATION",
  NO_AUTH_TOKEN = "NO_AUTH_TOKEN",
  SETTING_ACCOUNT = "SETTING_ACCOUNT",
  UNABLE_TO_AUTHENTICATE = "UNABLE_TO_AUTHENTICATE",
  UNHANDLED = "UNHANDLED"
}

export const enum EVENTS {
  ACCOUNT_SETUP = "ACCOUNT_SETUP",
  AUTHENTICATED = "AUTHENTICATED",
  CRITICAL = "CRITICAL",
  ERROR = "ERROR",
  MFA_REQUESTED = "MFA_REQUESTED"
}

export default class Robinhood extends EventEmitter {
  protected account: APIAccountInterface;
  protected authToken: string;
  protected headers: { [key: string]: string };
  protected options: RobinhoodConstructorOptions;
  protected request: request.RequestAPI<
    requestPromise.RequestPromise,
    requestPromise.RequestPromiseOptions,
    request.RequiredUriUrl
  >;

  constructor() {
    super();

    this.on(EVENTS.ACCOUNT_SETUP, () => this.emit(EVENTS.AUTHENTICATED));

    this.reset();
  }

  /**
   * Authenticates by kicking off the login process
   * and setting up user account values
   */
  public authenticate(options: RobinhoodConstructorOptions): void {
    if (!options) {
      throw new Error(ERRORS.INVALID_ROBINHOOD_CONFIGURATION);
    }

    this.setOptions(options);

    if (this.options.authToken) {
      this.setAuthToken(this.options.authToken);
    } else {
      this.loginWithCredentials();
    }
  }

  public setOptions(options: RobinhoodConstructorOptions): void {
    this.options = options;
  }

  /**
   * Logs in using Multi-Factor Authentication
   * @param  mfaCode {String}
   */
  public loginWithMFA(mfaCode: string): void {
    this.login(mfaCode).then(
      body => {
        if (body.token) {
          this.setAuthToken(body.token);
        } else {
          this.emitError({
            type: ERRORS.UNHANDLED,
            message: "No token when authenticating using MFA"
          });
        }
      },
      (error: requestPromiseErrors.RequestError) => {
        this.emitError({
          type: ERRORS.AUTHENTICATION_MFA,
          message: error.message
        });
      }
    );
  }

  public getAuthToken(): string {
    return this.authToken;
  }

  public expireToken(): Promise<Response> {
    if (!this.getAuthToken()) {
      return Promise.reject({ message: ERRORS.NO_AUTH_TOKEN });
    }

    return this.request
      .post({
        resolveWithFullResponse: true,
        uri: API_URL + ENDPOINTS.LOGOUT
      })
      .then(response => {
        this.reset();

        return Promise.resolve(response);
      });
  }

  public getQuote(symbols: string[] | string): Promise<APIQuoteResponse> {
    symbols = Array.isArray(symbols) ? symbols.join(",") : symbols;

    return this.request
      .get({
        uri: API_URL + ENDPOINTS.QUOTES,
        qs: { symbols: symbols.toUpperCase() }
      })
      .catch(error =>
        this.invalidTokenHandler(error, () => this.getQuote(symbols))
      );
  }

  public getInstrument(instrumentId: string): Promise<APIInstrumentResponse> {
    return this.request
      .get({
        uri:
          API_URL + ENDPOINTS.INSTRUMENT.replace(":instrumentID", instrumentId)
      })
      .catch(error =>
        this.invalidTokenHandler(error, () => this.getInstrument(instrumentId))
      );
  }

  public getInstrumentBySymbol(
    symbol: string
  ): Promise<APIInstrumentBySymbolResponse> {
    symbol = symbol.toUpperCase();

    return this.request
      .get({
        uri: API_URL + ENDPOINTS.INSTRUMENTS,
        qs: { symbol }
      })
      .catch(error =>
        this.invalidTokenHandler(error, () =>
          this.getInstrumentBySymbol(symbol)
        )
      );
  }

  public placeBuyOrder(
    order:
      | OrderMarketInterface
      | OrderLimitInterface
      | OrderStopMarketInterface
      | OrderStopLimitInterface
  ): Promise<APIOrderResponseInterface> {
    order.side = APIOrderSide.buy;
    return this.placeOrder(order as APIOrderCreateInterface);
  }

  public placeSellOrder(
    order:
      | OrderMarketInterface
      | OrderLimitInterface
      | OrderStopMarketInterface
      | OrderStopLimitInterface
  ): Promise<APIOrderResponseInterface> {
    order.side = APIOrderSide.sell;
    return this.placeOrder(order as APIOrderCreateInterface);
  }

  public getOrders(
    optionsArg?: APIOrdersParameters
  ): Promise<APIOrdersResponse> {
    let options = Object.assign({}, optionsArg);

    if (options.updated_at) {
      options["updated_at[gte]"] = options.updated_at;
      delete options.updated_at;
    }

    return this.request
      .get({
        uri: API_URL + ENDPOINTS.ORDERS,
        qs: options
      })
      .catch(error =>
        this.invalidTokenHandler(error, () => this.getOrders(optionsArg))
      );
  }

  public getOrder(orderId): Promise<APIOrderResponseInterface> {
    return this.request
      .get({
        uri: API_URL + ENDPOINTS.ORDER.replace(":orderID", orderId)
      })
      .catch(error =>
        this.invalidTokenHandler(error, () => this.getOrder(orderId))
      );
  }

  public cancelOrder(order: APIOrderResponseInterface): Promise<{}> {
    // Check if order is in a terminal state
    if (
      [
        APIOrderState.filled,
        APIOrderState.rejected,
        APIOrderState.canceled,
        APIOrderState.cancelled,
        APIOrderState.failed
      ].includes(order.state)
    ) {
      return Promise.resolve({});
    }

    let uri = order.cancel;
    if (!uri && order.id) {
      uri = API_URL + ENDPOINTS.CANCEL_ORDER.replace(":orderID", order.id);
    }

    return this.request
      .post({ uri })
      .catch(error =>
        this.invalidTokenHandler(error, () => this.cancelOrder(order))
      );
  }

  public getAccounts(): Promise<APIAccountResponse> {
    return this.request
      .get({ uri: API_URL + ENDPOINTS.ACCOUNTS })
      .catch(error =>
        this.invalidTokenHandler(error, () => this.getAccounts())
      );
  }

  public getFundamentals(symbol: string): Promise<APIFundamentalsResponse> {
    symbol = symbol.toUpperCase();

    return this.request
      .get({ uri: API_URL + ENDPOINTS.FUNDAMENTALS.replace(":symbol", symbol) })
      .catch(error =>
        this.invalidTokenHandler(error, () => this.getFundamentals(symbol))
      );
  }

  public requestURI(uri, method: "get" | "post" = "get"): Promise<any> {
    return this.request[method]({ uri }).catch(error =>
      this.invalidTokenHandler(error, () => this.requestURI(uri))
    );
  }

  /*******************
   * Private Methods *
   *******************/

  /**
   * Sets the authentication token and sets up user account as well
   * @param authToken {String}
   */
  protected setAuthToken(authToken): void {
    this.reset();
    this.authToken = authToken;
    this.headers = Object.assign(
      { Authorization: `Token ${authToken}` },
      this.headers
    );
    this.updateRequestWrapper();
    this.setAccount();
  }

  /**
   * Requests and stores account in memory
   * This account is necessary for most requests to the Robinhood API
   */
  protected setAccount(): void {
    this.getAccounts().then(
      body => {
        this.account = body.results[0];
        this.emit(EVENTS.ACCOUNT_SETUP);
      },
      (error: requestPromiseErrors.RequestError) => {
        this.emitError({
          type: ERRORS.SETTING_ACCOUNT,
          message: error.message
        });
      }
    );
  }

  /**
   * Handles an invalid token response
   * It'll attempt to login again, if unable to do so it emits an error
   *
   * @param  error {any} Error from request
   * @param  onSuccess {Function} Method to be called once login is successful
   */
  protected invalidTokenHandler(error: any, onSuccess: Function): Promise<any> {
    if (error && error.detail) {
      let normalizedError = error.detail
        .replace(/[^a-zA-Z]/g, "")
        .toLowerCase();
      let isInvalidToken = normalizedError === "invalidtoken";

      if (isInvalidToken) {
        return new Promise(resolve => {
          let timeout = setTimeout(() => {
            this.emitError(
              {
                type: ERRORS.UNABLE_TO_AUTHENTICATE,
                message: "Invalid token and unable to authenticate"
              },
              EVENTS.CRITICAL
            );
          }, REVALIDATE_TOKEN_TIMEOUT);

          this.reset();
          this.loginWithCredentials();
          this.once(EVENTS.AUTHENTICATED, () => {
            clearTimeout(timeout);
            resolve(onSuccess());
          });
        });
      }
    }

    // Reject
    return Promise.reject(error);
  }

  protected placeOrder(
    options: APIOrderCreateInterface
  ): Promise<APIOrderResponseInterface> {
    const formData: APIOrderCreateInterface = {
      account: this.account.url,
      instrument: options.instrument,
      time_in_force: options.time_in_force || APIOrderTimeInForce.gfd,
      quantity: options.quantity,
      type: options.type || APIOrderType.market,
      trigger: options.trigger || APIOrderTrigger.immediate,
      side: options.side,
      price: options.price || null,
      stop_price: options.stop_price || null,
      extended_hours: options.extended_hours || false,
      symbol: options.symbol.toUpperCase()
    };

    return this.request
      .post({
        uri: API_URL + ENDPOINTS.ORDERS,
        form: formData
      })
      .catch(error =>
        this.invalidTokenHandler(error, () => this.placeOrder(options))
      );
  }

  protected loginWithCredentials(): void {
    this.login().then(
      body => {
        if (body.token) {
          this.setAuthToken(body.token);
        } else if (body.mfa_required) {
          this.emit(EVENTS.MFA_REQUESTED, {
            mfa_type: body.mfa_type
          });
        } else {
          this.emitError({
            type: ERRORS.UNHANDLED,
            message: "Authentication body response is invalid"
          });
        }
      },
      (error: requestPromiseErrors.RequestError) => {
        this.emitError({
          type: ERRORS.AUTHENTICATION,
          message: error.message
        });
      }
    );
  }

  protected login(mfaCode?: string): Promise<APIAuthenticationResponse> {
    let formFields = {
      password: this.options.credentials.password,
      username: this.options.credentials.username
    };

    if (mfaCode) {
      formFields["mfa_code"] = mfaCode;
    }

    return this.request.post({
      uri: API_URL + ENDPOINTS.LOGIN,
      form: formFields
    });
  }

  protected reset(): void {
    this.account = null;
    this.authToken = null;
    this.headers = Object.assign({}, DEFAULT_HEADERS);
    this.updateRequestWrapper();
  }

  protected updateRequestWrapper(): void {
    this.request = requestPromise.defaults({
      headers: this.headers,
      json: true,
      gzip: true
    });
  }

  protected emitError(
    details: RobinhoodError,
    errorType: EVENTS = EVENTS.ERROR
  ): void {
    this.emit(errorType, details);
  }
}
