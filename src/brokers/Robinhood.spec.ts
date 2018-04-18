import {} from "mocha";
const { expect } = require("chai");
import sinon = require("sinon");
import requestPromise = require("request-promise-native");

import Robinhood, { EVENTS, ERRORS } from "./Robinhood";
import { API_URL, ENDPOINTS } from "./RobinhoodAPIConfiguration";
import {
  APIOrderTimeInForce,
  APIOrderType,
  APIOrderTrigger,
  APIOrderState
} from "./RobinhoodInterfaces";

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

describe("Robinhood", () => {
  describe("#authenticate", () => {
    describe("using a token", () => {
      let instance, authToken, requestStub, requestDefaultsStub;
      let accountsEndpointStub;

      beforeEach(() => {
        let get = sinon.stub();
        accountsEndpointStub = get
          .withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS })
          .resolves({
            results: [{ url: "http://foo.bar/baz" }]
          });
        let post = sinon.stub();
        requestStub = { get, post };
        requestDefaultsStub = sinon
          .stub(requestPromise, "defaults")
          .returns(requestStub);

        authToken = "foo7bar8baz";
        instance = new Robinhood();
      });

      afterEach(() => {
        requestDefaultsStub.restore();
      });

      it("throws exception on invalid configuration", () => {
        expect(instance.authenticate).to.throw();
      });

      it("creates a request wrapper with correct values", () => {
        instance.authenticate({ authToken });
        expect(requestDefaultsStub.lastCall.args).to.deep.equal([
          {
            headers: Object.assign(
              { Authorization: "Token foo7bar8baz" },
              DEFAULT_HEADERS
            ),
            json: true,
            gzip: true
          }
        ]);
      });

      it("makes a request to accounts endpoint", () => {
        instance.authenticate({ authToken });
        expect(accountsEndpointStub.callCount).to.equal(1);
      });

      it("emits authenticate event", done => {
        instance.on(EVENTS.AUTHENTICATED, () => {
          expect(accountsEndpointStub.callCount).to.equal(1);
          done();
        });
        instance.authenticate({ authToken });
      });

      it("emits error event on failure to receive accounts", done => {
        accountsEndpointStub.reset();
        accountsEndpointStub
          .withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS })
          .rejects({
            message: "foo bar"
          });
        instance.on(EVENTS.ERROR, error => {
          expect(accountsEndpointStub.callCount).to.equal(1);
          expect(error).to.deep.equal({
            type: ERRORS.SETTING_ACCOUNT,
            message: "foo bar"
          });
          done();
        });
        instance.authenticate({ authToken });
      });
    });

    describe("using credentials and no MFA", () => {
      let instance, credentials, requestStub, requestDefaultsStub;
      let accountsEndpointStub, loginEndpointStub;

      beforeEach(() => {
        credentials = { username: "foo", password: "bar" };

        let get = sinon.stub();
        accountsEndpointStub = get
          .withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS })
          .resolves({
            results: [{ url: "http://foo.bar/baz" }]
          });
        let post = sinon.stub();
        loginEndpointStub = post
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .resolves({ token: "foobarbaz" });
        requestStub = { get, post };
        requestDefaultsStub = sinon
          .stub(requestPromise, "defaults")
          .returns(requestStub);

        instance = new Robinhood();
      });

      afterEach(() => {
        requestDefaultsStub.restore();
      });

      it("requests the login endpoint", done => {
        instance.on(EVENTS.AUTHENTICATED, () => {
          expect(loginEndpointStub.callCount).to.equal(1);
          expect(loginEndpointStub.lastCall.args).to.deep.equal([
            {
              uri: API_URL + ENDPOINTS.LOGIN,
              form: {
                password: credentials.password,
                username: credentials.username
              }
            }
          ]);
          done();
        });
        instance.authenticate({ credentials });
      });

      it("creates request wrapper on login with correct values", done => {
        instance.on(EVENTS.AUTHENTICATED, () => {
          expect(requestDefaultsStub.lastCall.args).to.deep.equal([
            {
              headers: Object.assign(
                { Authorization: "Token foobarbaz" },
                DEFAULT_HEADERS
              ),
              json: true,
              gzip: true
            }
          ]);
          done();
        });
        instance.authenticate({ credentials });
      });

      it("on login makes a request to accounts endpoint", done => {
        instance.on(EVENTS.AUTHENTICATED, () => {
          expect(accountsEndpointStub.callCount).to.equal(1);
          done();
        });
        instance.authenticate({ credentials });
      });

      it("emits authenticate event after login & fetching account", done => {
        instance.on(EVENTS.AUTHENTICATED, () => {
          expect(loginEndpointStub.callCount).to.equal(1);
          expect(accountsEndpointStub.callCount).to.equal(1);
          done();
        });
        instance.authenticate({ credentials });
      });

      it("emits error event on failure to receive accounts", done => {
        accountsEndpointStub.reset();
        accountsEndpointStub
          .withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS })
          .rejects({
            message: "foo bar"
          });
        instance.on(EVENTS.ERROR, error => {
          expect(loginEndpointStub.callCount).to.equal(1);
          expect(error).to.deep.equal({
            type: ERRORS.SETTING_ACCOUNT,
            message: "foo bar"
          });
          done();
        });
        instance.authenticate({ credentials });
      });

      it("emits error event on unhandled response for login endpoint", done => {
        loginEndpointStub.reset();
        loginEndpointStub
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .resolves({
            unkownKey: "foo bar"
          });
        instance.on(EVENTS.ERROR, error => {
          expect(accountsEndpointStub.callCount).to.equal(0);
          expect(error).to.deep.equal({
            type: ERRORS.UNHANDLED,
            message: "Authentication body response is invalid"
          });
          done();
        });
        instance.authenticate({ credentials });
      });

      it("emits error event on error response from login", done => {
        loginEndpointStub.reset();
        loginEndpointStub
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .rejects({
            message: "Foo bar baz"
          });
        instance.on(EVENTS.ERROR, error => {
          expect(accountsEndpointStub.callCount).to.equal(0);
          expect(error).to.deep.equal({
            type: ERRORS.AUTHENTICATION,
            message: "Foo bar baz"
          });
          done();
        });
        instance.authenticate({ credentials });
      });
    });

    describe("using credentials and MFA", () => {
      let instance, credentials, requestStub, requestDefaultsStub;
      let accountsEndpointStub, loginEndpointStub;

      beforeEach(() => {
        credentials = { username: "foobar", password: "baz" };

        let get = sinon.stub();
        accountsEndpointStub = get
          .withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS })
          .resolves({
            results: [{ url: "http://foo.bar/baz" }]
          });
        let post = sinon.stub();
        loginEndpointStub = post;
        loginEndpointStub
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .resolves({ mfa_type: "sms", mfa_required: true });
        loginEndpointStub
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username,
              mfa_code: "BAZQUX"
            }
          })
          .resolves({
            token: "quxquxx"
          });
        requestStub = { get, post };
        requestDefaultsStub = sinon
          .stub(requestPromise, "defaults")
          .returns(requestStub);

        instance = new Robinhood();
      });

      afterEach(() => {
        requestDefaultsStub.restore();
      });

      it("requests the login endpoint", done => {
        let authenticateStub = sinon.stub();
        instance.on(EVENTS.AUTHENTICATED, authenticateStub);
        instance.on(EVENTS.MFA_REQUESTED, () => {
          expect(authenticateStub.callCount).to.equal(0);
          expect(loginEndpointStub.callCount).to.equal(1);
          expect(loginEndpointStub.lastCall.args).to.deep.equal([
            {
              uri: API_URL + ENDPOINTS.LOGIN,
              form: {
                password: credentials.password,
                username: credentials.username
              }
            }
          ]);
          done();
        });
        instance.authenticate({ credentials });
      });

      it("creates a request wrapper with default values", done => {
        let authenticateStub = sinon.stub();
        instance.on(EVENTS.AUTHENTICATED, authenticateStub);
        instance.on(EVENTS.MFA_REQUESTED, () => {
          expect(authenticateStub.callCount).to.equal(0);
          expect(requestDefaultsStub.callCount).to.equal(1);
          expect(requestDefaultsStub.lastCall.args).to.deep.equal([
            {
              headers: Object.assign({}, DEFAULT_HEADERS),
              json: true,
              gzip: true
            }
          ]);
          done();
        });
        instance.authenticate({ credentials });
      });

      it("emits error event on unhandled response for login endpoint", done => {
        loginEndpointStub.reset();
        loginEndpointStub
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .resolves({
            unkownKey: "foo bar"
          });
        instance.on(EVENTS.ERROR, error => {
          expect(accountsEndpointStub.callCount).to.equal(0);
          expect(error).to.deep.equal({
            type: ERRORS.UNHANDLED,
            message: "Authentication body response is invalid"
          });
          done();
        });
        instance.authenticate({ credentials });
      });

      it("emits error event on error response from login", done => {
        loginEndpointStub.reset();
        loginEndpointStub
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .rejects({
            message: "Foo bar baz"
          });
        instance.on(EVENTS.ERROR, error => {
          expect(accountsEndpointStub.callCount).to.equal(0);
          expect(error).to.deep.equal({
            type: ERRORS.AUTHENTICATION,
            message: "Foo bar baz"
          });
          done();
        });
        instance.authenticate({ credentials });
      });

      it("emits MFA_REQUESTED event", done => {
        let authenticateStub = sinon.stub();
        instance.on(EVENTS.AUTHENTICATED, authenticateStub);
        instance.on(EVENTS.MFA_REQUESTED, () => {
          expect(authenticateStub.callCount).to.equal(0);
          expect(requestDefaultsStub.callCount).to.equal(1);
          done();
        });
        instance.authenticate({ credentials });
      });

      it("logs in with MFA code and emits AUTHENTICATED event", done => {
        let authenticateStub = sinon.stub();
        instance.on(EVENTS.AUTHENTICATED, authenticateStub);

        instance.on(EVENTS.MFA_REQUESTED, () => {
          expect(authenticateStub.callCount).to.equal(0);
          expect(requestDefaultsStub.callCount).to.equal(1);

          instance.on(EVENTS.AUTHENTICATED, () => {
            expect(authenticateStub.callCount).to.equal(1);
            // 3 because of the `constructor` and twice for #setAuthToken calls
            expect(requestDefaultsStub.callCount).to.equal(3);
            expect(loginEndpointStub.callCount).to.equal(2);
            expect(loginEndpointStub.lastCall.args).to.deep.equal([
              {
                uri: API_URL + ENDPOINTS.LOGIN,
                form: {
                  password: credentials.password,
                  username: credentials.username,
                  mfa_code: "BAZQUX"
                }
              }
            ]);
            done();
          });

          instance.loginWithMFA("BAZQUX");
        });

        instance.authenticate({ credentials });
      });

      it("on login makes a request to accounts endpoint", done => {
        let authenticateStub = sinon.stub();
        instance.on(EVENTS.AUTHENTICATED, authenticateStub);

        instance.on(EVENTS.MFA_REQUESTED, () => {
          expect(authenticateStub.callCount).to.equal(0);
          expect(requestDefaultsStub.callCount).to.equal(1);

          instance.on(EVENTS.AUTHENTICATED, () => {
            expect(authenticateStub.callCount).to.equal(1);
            // 3 because of the `constructor` and twice for #setAuthToken calls
            expect(requestDefaultsStub.callCount).to.equal(3);
            expect(loginEndpointStub.callCount).to.equal(2);
            expect(accountsEndpointStub.callCount).to.equal(1);
            done();
          });

          instance.loginWithMFA("BAZQUX");
        });

        instance.authenticate({ credentials });
      });

      it("emits authenticate event after login & fetching account", done => {
        instance.on(EVENTS.MFA_REQUESTED, () => {
          instance.on(EVENTS.AUTHENTICATED, () => {
            // 3 because of the `constructor` and twice for #setAuthToken calls
            expect(requestDefaultsStub.callCount).to.equal(3);
            expect(loginEndpointStub.callCount).to.equal(2);
            expect(accountsEndpointStub.callCount).to.equal(1);
            done();
          });

          instance.loginWithMFA("BAZQUX");
        });

        instance.authenticate({ credentials });
      });

      it("emits error event on failure to receive accounts", done => {
        accountsEndpointStub.reset();
        accountsEndpointStub
          .withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS })
          .rejects({
            message: "foo bar"
          });

        instance.on(EVENTS.MFA_REQUESTED, () => {
          instance.on(EVENTS.ERROR, error => {
            // 3 because of the `constructor` and twice for #setAuthToken calls
            expect(requestDefaultsStub.callCount).to.equal(3);
            expect(loginEndpointStub.callCount).to.equal(2);
            expect(accountsEndpointStub.callCount).to.equal(1);
            expect(error).to.deep.equal({
              type: ERRORS.SETTING_ACCOUNT,
              message: "foo bar"
            });
            done();
          });

          instance.loginWithMFA("BAZQUX");
        });

        instance.authenticate({ credentials });
      });

      it("emits error on MFA login on invalid server response", done => {
        let authenticateStub = sinon.stub();
        instance.on(EVENTS.AUTHENTICATED, authenticateStub);

        instance.on(EVENTS.MFA_REQUESTED, () => {
          expect(authenticateStub.callCount).to.equal(0);
          expect(requestDefaultsStub.callCount).to.equal(1);

          loginEndpointStub.reset();
          loginEndpointStub
            .withArgs({
              uri: API_URL + ENDPOINTS.LOGIN,
              form: {
                password: credentials.password,
                username: credentials.username,
                mfa_code: "BAZQUX"
              }
            })
            .resolves({
              foo: "barbaz"
            });
          instance.on(EVENTS.ERROR, error => {
            expect(authenticateStub.callCount).to.equal(0);
            expect(requestDefaultsStub.callCount).to.equal(1);
            expect(loginEndpointStub.callCount).to.equal(1);
            expect(error).to.deep.equal({
              type: ERRORS.UNHANDLED,
              message: "No token when authenticating using MFA"
            });
            done();
          });

          instance.loginWithMFA("BAZQUX");
        });

        instance.authenticate({ credentials });
      });

      it("emits error on MFA login on erroneous server response", done => {
        let authenticateStub = sinon.stub();
        instance.on(EVENTS.AUTHENTICATED, authenticateStub);

        instance.on(EVENTS.MFA_REQUESTED, () => {
          expect(authenticateStub.callCount).to.equal(0);
          expect(requestDefaultsStub.callCount).to.equal(1);

          loginEndpointStub.reset();
          loginEndpointStub
            .withArgs({
              uri: API_URL + ENDPOINTS.LOGIN,
              form: {
                password: credentials.password,
                username: credentials.username,
                mfa_code: "BAZQUX"
              }
            })
            .rejects({
              message: "fooqux"
            });
          instance.on(EVENTS.ERROR, error => {
            expect(authenticateStub.callCount).to.equal(0);
            expect(requestDefaultsStub.callCount).to.equal(1);
            expect(loginEndpointStub.callCount).to.equal(1);
            expect(error).to.deep.equal({
              type: ERRORS.AUTHENTICATION_MFA,
              message: "fooqux"
            });
            done();
          });

          instance.loginWithMFA("BAZQUX");
        });

        instance.authenticate({ credentials });
      });
    });
  });

  describe("#getAuthToken", () => {
    it("returns null when there's no auth token", () => {
      let instance = new Robinhood();
      expect(instance.getAuthToken()).to.equal(null);
    });

    it("returns token after authenticating with an authToken", done => {
      let get = sinon.stub();
      get.withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS }).resolves({
        results: [{ url: "http://foo.bar/baz" }]
      });
      let post = sinon.stub();
      let requestStub = { get, post };
      let requestDefaultsStub = sinon
        .stub(requestPromise, "defaults")
        .returns(requestStub);

      let authToken = "foo7bar8baz";
      let credentials = { username: "foo", password: "bar" };
      let instance = new Robinhood();

      instance.on(EVENTS.AUTHENTICATED, () => {
        expect(instance.getAuthToken()).to.equal("foo7bar8baz");

        requestDefaultsStub.restore();
        done();
      });

      expect(instance.getAuthToken()).to.equal(null);
      instance.authenticate({ authToken, credentials });
    });

    it("returns token after authenticating with credentials", done => {
      let credentials = { username: "foo", password: "bar" };

      let get = sinon.stub();
      get.withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS }).resolves({
        results: [{ url: "http://foo.bar/baz" }]
      });
      let post = sinon.stub();
      let loginEndpointStub = post
        .withArgs({
          uri: API_URL + ENDPOINTS.LOGIN,
          form: {
            password: credentials.password,
            username: credentials.username
          }
        })
        .resolves({ token: "foobarbaz" });
      let requestStub = { get, post };
      let requestDefaultsStub = sinon
        .stub(requestPromise, "defaults")
        .returns(requestStub);

      let instance = new Robinhood();

      instance.on(EVENTS.AUTHENTICATED, () => {
        expect(loginEndpointStub.callCount).to.equal(1);
        expect(instance.getAuthToken()).to.equal("foobarbaz");

        requestDefaultsStub.restore();
        done();
      });

      expect(instance.getAuthToken()).to.equal(null);
      instance.authenticate({ credentials });
    });

    it("returns token after authenticating with credentials and MFA", done => {
      let credentials = { username: "foo", password: "bar" };

      let get = sinon.stub();
      get.withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS }).resolves({
        results: [{ url: "http://foo.bar/baz" }]
      });
      let post = sinon.stub();
      let loginEndpointStub = post;
      loginEndpointStub
        .withArgs({
          uri: API_URL + ENDPOINTS.LOGIN,
          form: {
            password: credentials.password,
            username: credentials.username
          }
        })
        .resolves({ mfa_type: "sms", mfa_required: true });
      loginEndpointStub
        .withArgs({
          uri: API_URL + ENDPOINTS.LOGIN,
          form: {
            password: credentials.password,
            username: credentials.username,
            mfa_code: "BAZQUX"
          }
        })
        .resolves({
          token: "quxquxx"
        });
      let requestStub = { get, post };
      let requestDefaultsStub = sinon
        .stub(requestPromise, "defaults")
        .returns(requestStub);

      let instance = new Robinhood();

      instance.on(EVENTS.MFA_REQUESTED, () => {
        expect(requestDefaultsStub.callCount).to.equal(1);
        expect(instance.getAuthToken()).to.equal(null);

        instance.on(EVENTS.AUTHENTICATED, () => {
          // 3 because of the `constructor` and twice for #setAuthToken calls
          expect(requestDefaultsStub.callCount).to.equal(3);
          expect(loginEndpointStub.callCount).to.equal(2);
          expect(instance.getAuthToken()).to.equal("quxquxx");

          requestDefaultsStub.restore();
          done();
        });

        instance.loginWithMFA("BAZQUX");
      });

      expect(instance.getAuthToken()).to.equal(null);
      instance.authenticate({ credentials });
    });
  });

  describe("#expireToken", () => {
    it("doesn't make a request if there's no authToken set", done => {
      let requestStub = { get: sinon.stub(), post: sinon.stub() };
      let requestDefaultsStub = sinon
        .stub(requestPromise, "defaults")
        .returns(requestStub);

      let instance = new Robinhood();
      instance.expireToken().then(function() {
        //
      },
      () => {
        expect(requestStub.get.callCount).to.equal(0);
        expect(requestStub.post.callCount).to.equal(0);

        requestDefaultsStub.restore();
        done();
      });
    });

    it("rejects with error if there's no authToken set", done => {
      let requestStub = { get: sinon.stub(), post: sinon.stub() };
      let requestDefaultsStub = sinon
        .stub(requestPromise, "defaults")
        .returns(requestStub);

      let instance = new Robinhood();
      instance.expireToken().then(function() {
        //
      },
      error => {
        expect(error).to.deep.equal({
          message: ERRORS.NO_AUTH_TOKEN
        });

        requestDefaultsStub.restore();
        done();
      });
    });

    it("makes request to expire token and resets account values", done => {
      let get = sinon.stub();
      get.withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS }).resolves({
        results: [{ url: "http://foo.bar/baz" }]
      });
      let post = sinon.stub().returns(Promise.resolve());
      let requestStub = { get, post };
      let requestDefaultsStub = sinon
        .stub(requestPromise, "defaults")
        .returns(requestStub);

      let authToken = "foo7bar8baz";
      let credentials = { username: "foo", password: "bar" };
      let instance = new Robinhood();

      expect(requestDefaultsStub.args[0]).to.deep.equal([
        {
          headers: Object.assign({}, DEFAULT_HEADERS),
          json: true,
          gzip: true
        }
      ]);
      instance.on(EVENTS.AUTHENTICATED, () => {
        expect(requestDefaultsStub.args[1]).to.deep.equal([
          {
            headers: Object.assign({}, DEFAULT_HEADERS),
            json: true,
            gzip: true
          }
        ]);
        instance.expireToken().then(() => {
          expect(post.lastCall.args).to.deep.equal([
            {
              resolveWithFullResponse: true,
              uri: API_URL + ENDPOINTS.LOGOUT
            }
          ]);
          expect(requestDefaultsStub.args[2]).to.deep.equal([
            {
              headers: Object.assign(
                { Authorization: "Token foo7bar8baz" },
                DEFAULT_HEADERS
              ),
              json: true,
              gzip: true
            }
          ]);
          expect(requestDefaultsStub.lastCall.args).to.deep.equal([
            {
              headers: Object.assign({}, DEFAULT_HEADERS),
              json: true,
              gzip: true
            }
          ]);

          requestDefaultsStub.restore();
          done();
        });
      });

      instance.authenticate({ authToken, credentials });
    });
  });

  describe("#getQuote", () => {
    let clock, requestStub, requestDefaultsStub, instance, get;

    beforeEach(() => {
      clock = sinon.useFakeTimers();

      get = sinon.stub();
      get
        .withArgs({
          uri: API_URL + ENDPOINTS.QUOTES,
          qs: { symbols: "FB" }
        })
        .resolves({ results: [{ foo: "bar" }] });
      get
        .withArgs({
          uri: API_URL + ENDPOINTS.QUOTES,
          qs: { symbols: "FB,AAPL,BABA" }
        })
        .resolves({
          results: [{ baz: "qux" }, { qux: "quxx" }, { quxx: "beez" }]
        });
      requestStub = { get };
      requestDefaultsStub = sinon
        .stub(requestPromise, "defaults")
        .returns(requestStub);

      instance = new Robinhood();
    });

    afterEach(() => {
      clock.restore();
      requestDefaultsStub.restore();
    });

    it("makes a request to the quotes endpoint", done => {
      instance.getQuote("FB").then(body => {
        expect(body).to.deep.equal({ results: [{ foo: "bar" }] });
        done();
      });
    });

    it("takes in an array of symbols", done => {
      instance.getQuote(["FB"]).then(body => {
        expect(body).to.deep.equal({ results: [{ foo: "bar" }] });
        done();
      });
    });

    it("takes in an array of many symbols", done => {
      instance.getQuote(["FB", "AAPL", "BABA"]).then(body => {
        expect(body).to.deep.equal({
          results: [{ baz: "qux" }, { qux: "quxx" }, { quxx: "beez" }]
        });
        done();
      });
    });

    it("symbols can be case insensitive with a string", done => {
      instance.getQuote("fb").then(body => {
        expect(body).to.deep.equal({ results: [{ foo: "bar" }] });
        done();
      });
    });

    it("symbols can be case insensitive with an array", done => {
      instance.getQuote(["fb", "AaPl", "baBa"]).then(body => {
        expect(body).to.deep.equal({
          results: [{ baz: "qux" }, { qux: "quxx" }, { quxx: "beez" }]
        });
        done();
      });
    });

    it("rejects promise on API error", done => {
      get.reset();
      get
        .withArgs({
          uri: API_URL + ENDPOINTS.QUOTES,
          qs: { symbols: "FB" }
        })
        .rejects({ detail: "foobar" });

      instance.getQuote("fb").then(
        () => {
          //
        },
        error => {
          expect(error).to.deep.equal({ detail: "foobar" });
          done();
        }
      );
    });

    describe("invalid token handling", () => {
      let authToken1, authToken2, credentials, instance, get, post;
      let accountsStub, errorListenerStub, criticalErrorListenerStub;

      beforeEach(done => {
        // Restore previously set stubs
        clock.restore();
        requestDefaultsStub.restore();

        clock = sinon.useFakeTimers();

        authToken1 = "foobar";
        authToken2 = "foobarbaz";
        credentials = { username: "foo", password: "baz" };
        errorListenerStub = sinon.stub();
        criticalErrorListenerStub = sinon.stub();

        get = sinon.stub();
        accountsStub = get
          .withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS })
          .resolves({
            results: [{ url: "http://foo.bar/baz" }]
          });

        let quotesStub = get.withArgs({
          uri: API_URL + ENDPOINTS.QUOTES,
          qs: { symbols: "FB" }
        });
        quotesStub.onFirstCall().rejects({ detail: "iNvaLid   Token!!,." });
        quotesStub.onSecondCall().resolves({
          results: [{ foo: "barbaz" }]
        });

        post = sinon.stub();
        post
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .resolves({ token: authToken2 });
        requestDefaultsStub = sinon
          .stub(requestPromise, "defaults")
          .returns({ get, post });

        instance = new Robinhood();

        expect(requestDefaultsStub.args[0]).to.deep.equal([
          { headers: DEFAULT_HEADERS, gzip: true, json: true }
        ]);
        instance.on(EVENTS.ERROR, errorListenerStub);
        instance.on(EVENTS.CRITICAL, criticalErrorListenerStub);
        instance.authenticate({ authToken: authToken1, credentials });
        instance.once(EVENTS.AUTHENTICATED, done);
      });

      it("authenticates and retries request on invalid token", done => {
        // Setting defaults from #authenticate call
        expect(requestDefaultsStub.args[1]).to.deep.equal([
          { headers: DEFAULT_HEADERS, gzip: true, json: true }
        ]);
        expect(requestDefaultsStub.args[2]).to.deep.equal([
          {
            headers: Object.assign(
              { Authorization: `Token ${authToken1}` },
              DEFAULT_HEADERS
            ),
            gzip: true,
            json: true
          }
        ]);

        instance.getQuote("FB").then(body => {
          // Get accounts for authentication
          expect(get.args[0]).to.deep.equal([
            { uri: "https://api.robinhood.com/accounts/" }
          ]);

          // Get quote the first time, this will fail
          expect(get.args[1]).to.deep.equal([
            {
              uri: API_URL + ENDPOINTS.QUOTES,
              qs: { symbols: "FB" }
            }
          ]);

          // Reset before #loginWithCredentials call
          expect(requestDefaultsStub.args[3]).to.deep.equal([
            { headers: DEFAULT_HEADERS, gzip: true, json: true }
          ]);

          // Authenticate
          expect(post.lastCall.args).to.deep.equal([
            {
              uri: "https://api.robinhood.com/api-token-auth/",
              form: { password: "baz", username: "foo" }
            }
          ]);
          // Two call to #requestDefaults after receiving authToke from login
          expect(requestDefaultsStub.args[4]).to.deep.equal([
            { headers: DEFAULT_HEADERS, gzip: true, json: true }
          ]);
          expect(requestDefaultsStub.lastCall.args).to.deep.equal([
            {
              headers: Object.assign(
                { Authorization: `Token ${authToken2}` },
                DEFAULT_HEADERS
              ),
              gzip: true,
              json: true
            }
          ]);
          // Request account again after re-authentication
          expect(get.args[2]).to.deep.equal([
            { uri: "https://api.robinhood.com/accounts/" }
          ]);

          // Get quote again after re-authentication occurs
          expect(get.lastCall.args).to.deep.equal([
            {
              uri: API_URL + ENDPOINTS.QUOTES,
              qs: { symbols: "FB" }
            }
          ]);

          // Finally inspect that the successful response is what we expect
          expect(body).to.deep.equal({ results: [{ foo: "barbaz" }] });
          expect(errorListenerStub.callCount).to.equal(0);
          expect(criticalErrorListenerStub.callCount).to.equal(0);

          done();
        });
      });

      it("emits critical error if fetching account after login fails", done => {
        accountsStub.reset();
        accountsStub.withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS }).rejects({
          message: "foobar"
        });

        instance.on(EVENTS.CRITICAL, error => {
          expect(errorListenerStub.callCount).to.equal(1);
          expect(errorListenerStub.args[0]).to.deep.equal([
            { type: ERRORS.SETTING_ACCOUNT, message: "foobar" }
          ]);

          expect(error).to.deep.equal({
            type: ERRORS.UNABLE_TO_AUTHENTICATE,
            message: "Invalid token and unable to authenticate"
          });

          done();
        });

        instance.getQuote("FB");
        process.nextTick(() => clock.tick(1000 * 60 * 6)); // 5 minutes
      });

      it("emits critical error if login request fails", done => {
        post.reset();
        post
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .rejects({ message: "bazquxquxx" });

        instance.on(EVENTS.CRITICAL, error => {
          expect(errorListenerStub.callCount).to.equal(1);
          expect(errorListenerStub.args[0]).to.deep.equal([
            { type: ERRORS.AUTHENTICATION, message: "bazquxquxx" }
          ]);

          expect(error).to.deep.equal({
            type: ERRORS.UNABLE_TO_AUTHENTICATE,
            message: "Invalid token and unable to authenticate"
          });

          done();
        });

        instance.getQuote("FB");
        process.nextTick(() => clock.tick(1000 * 60 * 6)); // 5 minutes
      });
    });
  });

  describe("#getInstrument", () => {
    let clock, requestStub, requestDefaultsStub, instance, get;

    beforeEach(done => {
      clock = sinon.useFakeTimers();

      get = sinon.stub();
      get.withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS }).resolves({
        results: [{ url: "http://foo.bar/baz" }]
      });
      get
        .withArgs({
          uri:
            API_URL + ENDPOINTS.INSTRUMENT.replace(":instrumentID", "foo-bar")
        })
        .resolves({
          foo: "bar"
        });
      requestStub = { get };
      requestDefaultsStub = sinon
        .stub(requestPromise, "defaults")
        .returns(requestStub);

      instance = new Robinhood();
      instance.authenticate({ authToken: "foobaz" });
      instance.once(EVENTS.AUTHENTICATED, done);
    });

    afterEach(() => {
      clock.restore();
      requestDefaultsStub.restore();
    });

    it("makes a request to get single order", done => {
      instance.getInstrument("foo-bar").then(body => {
        expect(body).to.deep.equal({
          foo: "bar"
        });
        done();
      });
    });

    it("rejects promise on API error", done => {
      get.reset();
      get
        .withArgs({
          uri:
            API_URL + ENDPOINTS.INSTRUMENT.replace(":instrumentID", "foo-bar")
        })
        .rejects({ detail: "foobar" });

      instance.getInstrument("foo-bar").then(
        () => {
          //
        },
        error => {
          expect(error).to.deep.equal({ detail: "foobar" });
          done();
        }
      );
    });

    describe("invalid token handling", () => {
      let authToken1, authToken2, credentials, instance, get, post;
      let accountsStub, errorListenerStub, criticalErrorListenerStub;

      beforeEach(done => {
        // Restore previously set stubs
        clock.restore();
        requestDefaultsStub.restore();

        clock = sinon.useFakeTimers();

        authToken1 = "foobar";
        authToken2 = "foobarbaz";
        credentials = { username: "foo", password: "baz" };
        errorListenerStub = sinon.stub();
        criticalErrorListenerStub = sinon.stub();

        get = sinon.stub();
        accountsStub = get
          .withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS })
          .resolves({
            results: [{ url: "http://foo.bar/baz" }]
          });

        let ordersStub = get.withArgs({
          uri:
            API_URL + ENDPOINTS.INSTRUMENT.replace(":instrumentID", "baz-qux")
        });
        ordersStub.onFirstCall().rejects({ detail: "iNvalid   Token!!,." });
        ordersStub.onSecondCall().resolves({
          qux: "quxx"
        });

        post = sinon.stub();
        post
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .resolves({ token: authToken2 });
        requestDefaultsStub = sinon
          .stub(requestPromise, "defaults")
          .returns({ get, post });

        instance = new Robinhood();

        expect(requestDefaultsStub.args[0]).to.deep.equal([
          { headers: DEFAULT_HEADERS, gzip: true, json: true }
        ]);
        instance.on(EVENTS.ERROR, errorListenerStub);
        instance.on(EVENTS.CRITICAL, criticalErrorListenerStub);
        instance.authenticate({ authToken: authToken1, credentials });
        instance.once(EVENTS.AUTHENTICATED, done);
      });

      it("authenticates and retries request on invalid token", done => {
        // Setting defaults from #authenticate call
        expect(requestDefaultsStub.args[1]).to.deep.equal([
          { headers: DEFAULT_HEADERS, gzip: true, json: true }
        ]);
        expect(requestDefaultsStub.args[2]).to.deep.equal([
          {
            headers: Object.assign(
              { Authorization: `Token ${authToken1}` },
              DEFAULT_HEADERS
            ),
            gzip: true,
            json: true
          }
        ]);

        instance.getInstrument("baz-qux").then(body => {
          // Get accounts for authentication
          expect(get.args[0]).to.deep.equal([
            { uri: "https://api.robinhood.com/accounts/" }
          ]);
          // Get quote the first time, this will fail
          expect(get.args[1]).to.deep.equal([
            {
              uri:
                API_URL +
                ENDPOINTS.INSTRUMENT.replace(":instrumentID", "baz-qux")
            }
          ]);

          // Reset before #loginWithCredentials call
          expect(requestDefaultsStub.args[3]).to.deep.equal([
            { headers: DEFAULT_HEADERS, gzip: true, json: true }
          ]);

          // Authenticate
          expect(post.lastCall.args).to.deep.equal([
            {
              uri: "https://api.robinhood.com/api-token-auth/",
              form: { password: "baz", username: "foo" }
            }
          ]);
          // Two call to #requestDefaults after receiving authToke from login
          expect(requestDefaultsStub.args[4]).to.deep.equal([
            { headers: DEFAULT_HEADERS, gzip: true, json: true }
          ]);
          expect(requestDefaultsStub.lastCall.args).to.deep.equal([
            {
              headers: Object.assign(
                { Authorization: `Token ${authToken2}` },
                DEFAULT_HEADERS
              ),
              gzip: true,
              json: true
            }
          ]);
          // Request account again after re-authentication
          expect(get.args[2]).to.deep.equal([
            { uri: "https://api.robinhood.com/accounts/" }
          ]);

          // Get quote again after re-authentication occurs
          expect(get.lastCall.args).to.deep.equal([
            {
              uri:
                API_URL +
                ENDPOINTS.INSTRUMENT.replace(":instrumentID", "baz-qux")
            }
          ]);

          // Finally inspect that the successful response is what we expect
          expect(body).to.deep.equal({
            qux: "quxx"
          });
          expect(errorListenerStub.callCount).to.equal(0);
          expect(criticalErrorListenerStub.callCount).to.equal(0);

          done();
        });
      });

      it("emits critical error if fetching account after login fails", done => {
        accountsStub.reset();
        accountsStub.withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS }).rejects({
          message: "foobar"
        });

        instance.on(EVENTS.CRITICAL, error => {
          expect(errorListenerStub.callCount).to.equal(1);
          expect(errorListenerStub.args[0]).to.deep.equal([
            { type: ERRORS.SETTING_ACCOUNT, message: "foobar" }
          ]);

          expect(error).to.deep.equal({
            type: ERRORS.UNABLE_TO_AUTHENTICATE,
            message: "Invalid token and unable to authenticate"
          });

          done();
        });

        instance.getInstrument("baz-qux");
        process.nextTick(() => clock.tick(1000 * 60 * 6)); // 5 minutes
      });

      it("emits critical error if login request fails", done => {
        post.reset();
        post
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .rejects({ message: "bazquxquxx" });

        instance.on(EVENTS.CRITICAL, error => {
          expect(errorListenerStub.callCount).to.equal(1);
          expect(errorListenerStub.args[0]).to.deep.equal([
            { type: ERRORS.AUTHENTICATION, message: "bazquxquxx" }
          ]);

          expect(error).to.deep.equal({
            type: ERRORS.UNABLE_TO_AUTHENTICATE,
            message: "Invalid token and unable to authenticate"
          });

          done();
        });

        instance.getInstrument("baz-qux");
        process.nextTick(() => clock.tick(1000 * 60 * 6)); // 5 minutes
      });
    });
  });

  describe("#getInstrumentBySymbol", () => {
    let clock, requestStub, requestDefaultsStub, instance, get;

    beforeEach(done => {
      clock = sinon.useFakeTimers();

      get = sinon.stub();
      get.withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS }).resolves({
        results: [{ url: "http://foo.bar/baz" }]
      });
      get
        .withArgs({
          uri: API_URL + ENDPOINTS.INSTRUMENTS,
          qs: { symbol: "FOO" }
        })
        .resolves({
          results: [{ symbol: "FOO", id: "foo-bar" }]
        });
      requestStub = { get };
      requestDefaultsStub = sinon
        .stub(requestPromise, "defaults")
        .returns(requestStub);

      instance = new Robinhood();
      instance.authenticate({ authToken: "foobaz" });
      instance.once(EVENTS.AUTHENTICATED, done);
    });

    afterEach(() => {
      clock.restore();
      requestDefaultsStub.restore();
    });

    it("makes a request to get single order", done => {
      instance.getInstrumentBySymbol("FOO").then(body => {
        expect(body).to.deep.equal({
          results: [{ symbol: "FOO", id: "foo-bar" }]
        });
        done();
      });
    });

    it("it's not case sensitive", done => {
      instance.getInstrumentBySymbol("fOo").then(body => {
        expect(body).to.deep.equal({
          results: [{ symbol: "FOO", id: "foo-bar" }]
        });
        done();
      });
    });

    it("rejects promise on API error", done => {
      get.reset();
      get
        .withArgs({
          uri: API_URL + ENDPOINTS.INSTRUMENTS,
          qs: { symbol: "FOO" }
        })
        .rejects({ detail: "foobar" });

      instance.getInstrumentBySymbol("FOO").then(
        () => {
          //
        },
        error => {
          expect(error).to.deep.equal({ detail: "foobar" });
          done();
        }
      );
    });

    describe("invalid token handling", () => {
      let authToken1, authToken2, credentials, instance, get, post;
      let accountsStub, errorListenerStub, criticalErrorListenerStub;

      beforeEach(done => {
        // Restore previously set stubs
        clock.restore();
        requestDefaultsStub.restore();

        clock = sinon.useFakeTimers();

        authToken1 = "foobar";
        authToken2 = "foobarbaz";
        credentials = { username: "foo", password: "baz" };
        errorListenerStub = sinon.stub();
        criticalErrorListenerStub = sinon.stub();

        get = sinon.stub();
        accountsStub = get
          .withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS })
          .resolves({
            results: [{ url: "http://foo.bar/baz" }]
          });

        let ordersStub = get.withArgs({
          uri: API_URL + ENDPOINTS.INSTRUMENTS,
          qs: { symbol: "BAR" }
        });
        ordersStub.onFirstCall().rejects({ detail: "iNvalid   Token!!,." });
        ordersStub.onSecondCall().resolves({
          qux: "quxx"
        });

        post = sinon.stub();
        post
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .resolves({ token: authToken2 });
        requestDefaultsStub = sinon
          .stub(requestPromise, "defaults")
          .returns({ get, post });

        instance = new Robinhood();

        expect(requestDefaultsStub.args[0]).to.deep.equal([
          { headers: DEFAULT_HEADERS, gzip: true, json: true }
        ]);
        instance.on(EVENTS.ERROR, errorListenerStub);
        instance.on(EVENTS.CRITICAL, criticalErrorListenerStub);
        instance.authenticate({ authToken: authToken1, credentials });
        instance.once(EVENTS.AUTHENTICATED, done);
      });

      it("authenticates and retries request on invalid token", done => {
        // Setting defaults from #authenticate call
        expect(requestDefaultsStub.args[1]).to.deep.equal([
          { headers: DEFAULT_HEADERS, gzip: true, json: true }
        ]);
        expect(requestDefaultsStub.args[2]).to.deep.equal([
          {
            headers: Object.assign(
              { Authorization: `Token ${authToken1}` },
              DEFAULT_HEADERS
            ),
            gzip: true,
            json: true
          }
        ]);

        instance.getInstrumentBySymbol("BAR").then(body => {
          // Get accounts for authentication
          expect(get.args[0]).to.deep.equal([
            { uri: "https://api.robinhood.com/accounts/" }
          ]);
          // Get quote the first time, this will fail
          expect(get.args[1]).to.deep.equal([
            {
              uri: API_URL + ENDPOINTS.INSTRUMENTS,
              qs: { symbol: "BAR" }
            }
          ]);

          // Reset before #loginWithCredentials call
          expect(requestDefaultsStub.args[3]).to.deep.equal([
            { headers: DEFAULT_HEADERS, gzip: true, json: true }
          ]);

          // Authenticate
          expect(post.lastCall.args).to.deep.equal([
            {
              uri: "https://api.robinhood.com/api-token-auth/",
              form: { password: "baz", username: "foo" }
            }
          ]);
          // Two call to #requestDefaults after receiving authToke from login
          expect(requestDefaultsStub.args[4]).to.deep.equal([
            { headers: DEFAULT_HEADERS, gzip: true, json: true }
          ]);
          expect(requestDefaultsStub.lastCall.args).to.deep.equal([
            {
              headers: Object.assign(
                { Authorization: `Token ${authToken2}` },
                DEFAULT_HEADERS
              ),
              gzip: true,
              json: true
            }
          ]);
          // Request account again after re-authentication
          expect(get.args[2]).to.deep.equal([
            { uri: "https://api.robinhood.com/accounts/" }
          ]);

          // Get quote again after re-authentication occurs
          expect(get.lastCall.args).to.deep.equal([
            {
              uri: API_URL + ENDPOINTS.INSTRUMENTS,
              qs: { symbol: "BAR" }
            }
          ]);

          // Finally inspect that the successful response is what we expect
          expect(body).to.deep.equal({
            qux: "quxx"
          });
          expect(errorListenerStub.callCount).to.equal(0);
          expect(criticalErrorListenerStub.callCount).to.equal(0);

          done();
        });
      });

      it("emits critical error if fetching account after login fails", done => {
        accountsStub.reset();
        accountsStub.withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS }).rejects({
          message: "foobar"
        });

        instance.on(EVENTS.CRITICAL, error => {
          expect(errorListenerStub.callCount).to.equal(1);
          expect(errorListenerStub.args[0]).to.deep.equal([
            { type: ERRORS.SETTING_ACCOUNT, message: "foobar" }
          ]);

          expect(error).to.deep.equal({
            type: ERRORS.UNABLE_TO_AUTHENTICATE,
            message: "Invalid token and unable to authenticate"
          });

          done();
        });

        instance.getInstrumentBySymbol("BAR");
        process.nextTick(() => clock.tick(1000 * 60 * 6)); // 5 minutes
      });

      it("emits critical error if login request fails", done => {
        post.reset();
        post
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .rejects({ message: "bazquxquxx" });

        instance.on(EVENTS.CRITICAL, error => {
          expect(errorListenerStub.callCount).to.equal(1);
          expect(errorListenerStub.args[0]).to.deep.equal([
            { type: ERRORS.AUTHENTICATION, message: "bazquxquxx" }
          ]);

          expect(error).to.deep.equal({
            type: ERRORS.UNABLE_TO_AUTHENTICATE,
            message: "Invalid token and unable to authenticate"
          });

          done();
        });

        instance.getInstrumentBySymbol("BAR");
        process.nextTick(() => clock.tick(1000 * 60 * 6)); // 5 minutes
      });
    });
  });

  describe("#placeBuyOrder", () => {
    let clock, requestStub, requestDefaultsStub, instance, orderObject;
    let get, post;

    beforeEach(done => {
      clock = sinon.useFakeTimers();

      orderObject = {
        instrument: "http://baz.qux",
        quantity: "25.0000",
        symbol: "FB",
        time_in_force: APIOrderTimeInForce.gtc,
        type: APIOrderType.limit,
        price: "10.0000",
        extended_hours: true
      };

      get = sinon.stub();
      get.withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS }).resolves({
        results: [{ url: "http://foo.bar/baz" }]
      });

      post = sinon.stub();
      post
        .withArgs({
          uri: API_URL + ENDPOINTS.ORDERS,
          form: Object.assign(
            {
              account: "http://foo.bar/baz",
              trigger: APIOrderTrigger.immediate,
              side: "buy",
              stop_price: null
            },
            orderObject
          )
        })
        .resolves({ foo: "bar", baz: "qux" });
      requestStub = { get, post };
      requestDefaultsStub = sinon
        .stub(requestPromise, "defaults")
        .returns(requestStub);

      instance = new Robinhood();
      instance.authenticate({ authToken: "foobaz" });
      instance.once(EVENTS.AUTHENTICATED, done);
    });

    afterEach(() => {
      clock.restore();
      requestDefaultsStub.restore();
    });

    it("makes a request to the orders endpoint", done => {
      instance.placeBuyOrder(orderObject).then(body => {
        expect(body).to.deep.equal({ foo: "bar", baz: "qux" });
        done();
      });
    });

    it("sets side to 'buy'", done => {
      orderObject.side = "sell";
      instance.placeBuyOrder(orderObject).then(body => {
        expect(body).to.deep.equal({ foo: "bar", baz: "qux" });
        done();
      });
    });

    it("rejects promise on API error", done => {
      post.reset();
      post
        .withArgs({
          uri: API_URL + ENDPOINTS.ORDERS,
          form: Object.assign(
            {
              account: "http://foo.bar/baz",
              trigger: APIOrderTrigger.immediate,
              side: "buy",
              stop_price: null
            },
            orderObject
          )
        })
        .rejects({ detail: "foobar" });

      instance.placeBuyOrder(orderObject).then(
        () => {
          //
        },
        error => {
          expect(error).to.deep.equal({ detail: "foobar" });
          done();
        }
      );
    });

    describe("invalid token handling", () => {
      let authToken1, authToken2, credentials, instance, get, post, orderObject;
      let accountsStub, loginStub, errorListenerStub, criticalErrorListenerStub;

      beforeEach(done => {
        // Restore previously set stubs
        clock.restore();
        requestDefaultsStub.restore();

        clock = sinon.useFakeTimers();

        authToken1 = "foobar";
        authToken2 = "foobarbaz";
        credentials = { username: "foo", password: "baz" };
        errorListenerStub = sinon.stub();
        criticalErrorListenerStub = sinon.stub();

        get = sinon.stub();
        accountsStub = get
          .withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS })
          .resolves({
            results: [{ url: "http://foo.bar/baz" }]
          });

        orderObject = {
          instrument: "http://baz.qux",
          quantity: "25.0000",
          symbol: "FB",
          time_in_force: APIOrderTimeInForce.gtc,
          type: APIOrderType.limit,
          price: "10.0000",
          extended_hours: true
        };

        post = sinon.stub();

        let orderStub = post.withArgs({
          uri: API_URL + ENDPOINTS.ORDERS,
          form: Object.assign(
            {
              account: "http://foo.bar/baz",
              trigger: APIOrderTrigger.immediate,
              side: "buy",
              stop_price: null
            },
            orderObject
          )
        });
        orderStub.onFirstCall().rejects({ detail: "iNvaLid   Token!!,." });
        orderStub.onSecondCall().resolves({ bar: "baz", qux: "quxx" });

        loginStub = post
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .resolves({ token: authToken2 });
        requestDefaultsStub = sinon
          .stub(requestPromise, "defaults")
          .returns({ get, post });

        instance = new Robinhood();

        expect(requestDefaultsStub.args[0]).to.deep.equal([
          { headers: DEFAULT_HEADERS, gzip: true, json: true }
        ]);
        instance.on(EVENTS.ERROR, errorListenerStub);
        instance.on(EVENTS.CRITICAL, criticalErrorListenerStub);
        instance.authenticate({ authToken: authToken1, credentials });
        instance.once(EVENTS.AUTHENTICATED, done);
      });

      it("authenticates and retries request on invalid token", done => {
        // Setting defaults from #authenticate call
        expect(requestDefaultsStub.args[1]).to.deep.equal([
          { headers: DEFAULT_HEADERS, gzip: true, json: true }
        ]);
        expect(requestDefaultsStub.args[2]).to.deep.equal([
          {
            headers: Object.assign(
              { Authorization: `Token ${authToken1}` },
              DEFAULT_HEADERS
            ),
            gzip: true,
            json: true
          }
        ]);

        instance.placeBuyOrder(orderObject).then(body => {
          // Get accounts for authentication
          expect(get.args[0]).to.deep.equal([
            { uri: "https://api.robinhood.com/accounts/" }
          ]);

          // Post order the first time, this will fail
          expect(post.args[0]).to.deep.equal([
            {
              uri: API_URL + ENDPOINTS.ORDERS,
              form: Object.assign(
                {
                  account: "http://foo.bar/baz",
                  trigger: APIOrderTrigger.immediate,
                  side: "buy",
                  stop_price: null
                },
                orderObject
              )
            }
          ]);

          // Reset before #loginWithCredentials call
          expect(requestDefaultsStub.args[3]).to.deep.equal([
            { headers: DEFAULT_HEADERS, gzip: true, json: true }
          ]);

          // Authenticate
          expect(post.args[1]).to.deep.equal([
            {
              uri: "https://api.robinhood.com/api-token-auth/",
              form: { password: "baz", username: "foo" }
            }
          ]);
          // Two call to #requestDefaults after receiving authToke from login
          expect(requestDefaultsStub.args[4]).to.deep.equal([
            { headers: DEFAULT_HEADERS, gzip: true, json: true }
          ]);
          expect(requestDefaultsStub.lastCall.args).to.deep.equal([
            {
              headers: Object.assign(
                { Authorization: `Token ${authToken2}` },
                DEFAULT_HEADERS
              ),
              gzip: true,
              json: true
            }
          ]);
          // Request account again after re-authentication
          expect(get.lastCall.args).to.deep.equal([
            { uri: "https://api.robinhood.com/accounts/" }
          ]);

          // Get quote again after re-authentication occurs
          expect(post.lastCall.args).to.deep.equal([
            {
              uri: API_URL + ENDPOINTS.ORDERS,
              form: Object.assign(
                {
                  account: "http://foo.bar/baz",
                  trigger: APIOrderTrigger.immediate,
                  side: "buy",
                  stop_price: null
                },
                orderObject
              )
            }
          ]);

          // Finally inspect that the successful response is what we expect
          expect(body).to.deep.equal({ bar: "baz", qux: "quxx" });
          expect(errorListenerStub.callCount).to.equal(0);
          expect(criticalErrorListenerStub.callCount).to.equal(0);

          done();
        });
      });

      it("emits critical error if fetching account after login fails", done => {
        accountsStub.reset();
        accountsStub.withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS }).rejects({
          message: "foobar"
        });

        instance.on(EVENTS.CRITICAL, error => {
          expect(errorListenerStub.callCount).to.equal(1);
          expect(errorListenerStub.args[0]).to.deep.equal([
            { type: ERRORS.SETTING_ACCOUNT, message: "foobar" }
          ]);

          expect(error).to.deep.equal({
            type: ERRORS.UNABLE_TO_AUTHENTICATE,
            message: "Invalid token and unable to authenticate"
          });

          done();
        });

        instance.placeBuyOrder(orderObject);
        process.nextTick(() => clock.tick(1000 * 60 * 6)); // 5 minutes
      });

      it("emits critical error if login request fails", done => {
        loginStub.reset();
        loginStub
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .rejects({ message: "bazquxquxx" });

        instance.on(EVENTS.CRITICAL, error => {
          expect(errorListenerStub.callCount).to.equal(1);
          expect(errorListenerStub.args[0]).to.deep.equal([
            { type: ERRORS.AUTHENTICATION, message: "bazquxquxx" }
          ]);

          expect(error).to.deep.equal({
            type: ERRORS.UNABLE_TO_AUTHENTICATE,
            message: "Invalid token and unable to authenticate"
          });

          done();
        });

        instance.placeBuyOrder(orderObject);
        process.nextTick(() => clock.tick(1000 * 60 * 6)); // 5 minutes
      });
    });
  });

  describe("#placeSellOrder", () => {
    let clock, requestStub, requestDefaultsStub, instance, orderObject;
    let get, post;

    beforeEach(done => {
      clock = sinon.useFakeTimers();

      orderObject = {
        instrument: "http://baz.qux",
        quantity: "25.0000",
        symbol: "FB",
        time_in_force: APIOrderTimeInForce.gtc,
        trigger: APIOrderTrigger.stop,
        stop_price: "10.0000",
        extended_hours: true
      };

      get = sinon.stub();
      get.withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS }).resolves({
        results: [{ url: "http://foo.bar/baz" }]
      });

      post = sinon.stub();
      post
        .withArgs({
          uri: API_URL + ENDPOINTS.ORDERS,
          form: Object.assign(
            {
              account: "http://foo.bar/baz",
              type: APIOrderType.market,
              side: "sell",
              price: null
            },
            orderObject
          )
        })
        .resolves({ foo: "bar", baz: "qux" });
      requestStub = { get, post };
      requestDefaultsStub = sinon
        .stub(requestPromise, "defaults")
        .returns(requestStub);

      instance = new Robinhood();
      instance.authenticate({ authToken: "foobaz" });
      instance.once(EVENTS.AUTHENTICATED, done);
    });

    afterEach(() => {
      clock.restore();
      requestDefaultsStub.restore();
    });

    it("makes a request to the orders endpoint", done => {
      instance.placeSellOrder(orderObject).then(body => {
        expect(body).to.deep.equal({ foo: "bar", baz: "qux" });
        done();
      });
    });

    it("sets side to 'sell'", done => {
      orderObject.side = "buy";
      instance.placeSellOrder(orderObject).then(body => {
        expect(body).to.deep.equal({ foo: "bar", baz: "qux" });
        done();
      });
    });

    it("rejects promise on API error", done => {
      post.reset();
      post
        .withArgs({
          uri: API_URL + ENDPOINTS.ORDERS,
          form: Object.assign(
            {
              account: "http://foo.bar/baz",
              type: APIOrderType.market,
              side: "sell",
              price: null
            },
            orderObject
          )
        })
        .rejects({ detail: "foobar" });

      instance.placeSellOrder(orderObject).then(
        () => {
          //
        },
        error => {
          expect(error).to.deep.equal({ detail: "foobar" });
          done();
        }
      );
    });

    describe("invalid token handling", () => {
      let authToken1, authToken2, credentials, instance, get, post, orderObject;
      let accountsStub, loginStub, errorListenerStub, criticalErrorListenerStub;

      beforeEach(done => {
        // Restore previously set stubs
        clock.restore();
        requestDefaultsStub.restore();

        clock = sinon.useFakeTimers();

        authToken1 = "foobar";
        authToken2 = "foobarbaz";
        credentials = { username: "foo", password: "baz" };
        errorListenerStub = sinon.stub();
        criticalErrorListenerStub = sinon.stub();

        get = sinon.stub();
        accountsStub = get
          .withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS })
          .resolves({
            results: [{ url: "http://foo.bar/baz" }]
          });

        orderObject = {
          instrument: "http://baz.qux",
          quantity: "25.0000",
          symbol: "FB",
          time_in_force: APIOrderTimeInForce.gtc,
          type: APIOrderType.limit,
          trigger: APIOrderTrigger.stop,
          price: "10.0000",
          stop_price: "12.0000",
          extended_hours: true
        };

        post = sinon.stub();

        let orderStub = post.withArgs({
          uri: API_URL + ENDPOINTS.ORDERS,
          form: Object.assign(
            {
              account: "http://foo.bar/baz",
              side: "sell"
            },
            orderObject
          )
        });
        orderStub.onFirstCall().rejects({ detail: "iNvaLid   Token!!,." });
        orderStub.onSecondCall().resolves({ bar: "baz", qux: "quxx" });

        loginStub = post
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .resolves({ token: authToken2 });
        requestDefaultsStub = sinon
          .stub(requestPromise, "defaults")
          .returns({ get, post });

        instance = new Robinhood();

        expect(requestDefaultsStub.args[0]).to.deep.equal([
          { headers: DEFAULT_HEADERS, gzip: true, json: true }
        ]);
        instance.on(EVENTS.ERROR, errorListenerStub);
        instance.on(EVENTS.CRITICAL, criticalErrorListenerStub);
        instance.authenticate({ authToken: authToken1, credentials });
        instance.once(EVENTS.AUTHENTICATED, done);
      });

      it("authenticates and retries request on invalid token", done => {
        // Setting defaults from #authenticate call
        expect(requestDefaultsStub.args[1]).to.deep.equal([
          { headers: DEFAULT_HEADERS, gzip: true, json: true }
        ]);
        expect(requestDefaultsStub.args[2]).to.deep.equal([
          {
            headers: Object.assign(
              { Authorization: `Token ${authToken1}` },
              DEFAULT_HEADERS
            ),
            gzip: true,
            json: true
          }
        ]);

        instance.placeSellOrder(orderObject).then(body => {
          // Get accounts for authentication
          expect(get.args[0]).to.deep.equal([
            { uri: "https://api.robinhood.com/accounts/" }
          ]);

          // Post order the first time, this will fail
          expect(post.args[0]).to.deep.equal([
            {
              uri: API_URL + ENDPOINTS.ORDERS,
              form: Object.assign(
                {
                  account: "http://foo.bar/baz",
                  side: "sell"
                },
                orderObject
              )
            }
          ]);

          // Reset before #loginWithCredentials call
          expect(requestDefaultsStub.args[3]).to.deep.equal([
            { headers: DEFAULT_HEADERS, gzip: true, json: true }
          ]);

          // Authenticate
          expect(post.args[1]).to.deep.equal([
            {
              uri: "https://api.robinhood.com/api-token-auth/",
              form: { password: "baz", username: "foo" }
            }
          ]);
          // Two call to #requestDefaults after receiving authToke from login
          expect(requestDefaultsStub.args[4]).to.deep.equal([
            { headers: DEFAULT_HEADERS, gzip: true, json: true }
          ]);
          expect(requestDefaultsStub.lastCall.args).to.deep.equal([
            {
              headers: Object.assign(
                { Authorization: `Token ${authToken2}` },
                DEFAULT_HEADERS
              ),
              gzip: true,
              json: true
            }
          ]);
          // Request account again after re-authentication
          expect(get.lastCall.args).to.deep.equal([
            { uri: "https://api.robinhood.com/accounts/" }
          ]);

          // Get quote again after re-authentication occurs
          expect(post.lastCall.args).to.deep.equal([
            {
              uri: API_URL + ENDPOINTS.ORDERS,
              form: Object.assign(
                {
                  account: "http://foo.bar/baz",
                  side: "sell"
                },
                orderObject
              )
            }
          ]);

          // Finally inspect that the successful response is what we expect
          expect(body).to.deep.equal({ bar: "baz", qux: "quxx" });
          expect(errorListenerStub.callCount).to.equal(0);
          expect(criticalErrorListenerStub.callCount).to.equal(0);

          done();
        });
      });

      it("emits critical error if fetching account after login fails", done => {
        accountsStub.reset();
        accountsStub.withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS }).rejects({
          message: "foobar"
        });

        instance.on(EVENTS.CRITICAL, error => {
          expect(errorListenerStub.callCount).to.equal(1);
          expect(errorListenerStub.args[0]).to.deep.equal([
            { type: ERRORS.SETTING_ACCOUNT, message: "foobar" }
          ]);

          expect(error).to.deep.equal({
            type: ERRORS.UNABLE_TO_AUTHENTICATE,
            message: "Invalid token and unable to authenticate"
          });

          done();
        });

        instance.placeSellOrder(orderObject);
        process.nextTick(() => clock.tick(1000 * 60 * 6)); // 5 minutes
      });

      it("emits critical error if login request fails", done => {
        loginStub.reset();
        loginStub
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .rejects({ message: "bazquxquxx" });

        instance.on(EVENTS.CRITICAL, error => {
          expect(errorListenerStub.callCount).to.equal(1);
          expect(errorListenerStub.args[0]).to.deep.equal([
            { type: ERRORS.AUTHENTICATION, message: "bazquxquxx" }
          ]);

          expect(error).to.deep.equal({
            type: ERRORS.UNABLE_TO_AUTHENTICATE,
            message: "Invalid token and unable to authenticate"
          });

          done();
        });

        instance.placeSellOrder(orderObject);
        process.nextTick(() => clock.tick(1000 * 60 * 6)); // 5 minutes
      });
    });
  });

  describe("#getOrders", () => {
    let clock, requestStub, requestDefaultsStub, instance, get;

    beforeEach(done => {
      clock = sinon.useFakeTimers();

      get = sinon.stub();
      get.withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS }).resolves({
        results: [{ url: "http://foo.bar/baz" }]
      });
      get
        .withArgs({
          uri: API_URL + ENDPOINTS.ORDERS,
          qs: {}
        })
        .resolves({
          prev: null,
          results: [{ foo: "bar" }, { baz: "qux" }, { qux: "quxx" }],
          next: null
        });
      get
        .withArgs({
          uri: API_URL + ENDPOINTS.ORDERS,
          qs: { "updated_at[gte]": "foobar" }
        })
        .resolves({
          prev: null,
          results: [{ qux: "quxx" }],
          next: null
        });
      requestStub = { get };
      requestDefaultsStub = sinon
        .stub(requestPromise, "defaults")
        .returns(requestStub);

      instance = new Robinhood();
      instance.authenticate({ authToken: "foobaz" });
      instance.once(EVENTS.AUTHENTICATED, done);
    });

    afterEach(() => {
      clock.restore();
      requestDefaultsStub.restore();
    });

    it("makes a request to the orders endpoint", done => {
      instance.getOrders().then(body => {
        expect(body).to.deep.equal({
          prev: null,
          results: [{ foo: "bar" }, { baz: "qux" }, { qux: "quxx" }],
          next: null
        });
        done();
      });
    });

    it("takes handles update_at option", done => {
      instance.getOrders({ updated_at: "foobar" }).then(body => {
        expect(body).to.deep.equal({
          prev: null,
          results: [{ qux: "quxx" }],
          next: null
        });
        done();
      });
    });

    it("rejects promise on API error", done => {
      get.reset();
      get
        .withArgs({
          uri: API_URL + ENDPOINTS.ORDERS,
          qs: {}
        })
        .rejects({ detail: "foobar" });

      instance.getOrders().then(
        () => {
          //
        },
        error => {
          expect(error).to.deep.equal({ detail: "foobar" });
          done();
        }
      );
    });

    describe("invalid token handling", () => {
      let authToken1, authToken2, credentials, instance, get, post;
      let accountsStub, errorListenerStub, criticalErrorListenerStub;

      beforeEach(done => {
        // Restore previously set stubs
        clock.restore();
        requestDefaultsStub.restore();

        clock = sinon.useFakeTimers();

        authToken1 = "foobar";
        authToken2 = "foobarbaz";
        credentials = { username: "foo", password: "baz" };
        errorListenerStub = sinon.stub();
        criticalErrorListenerStub = sinon.stub();

        get = sinon.stub();
        accountsStub = get
          .withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS })
          .resolves({
            results: [{ url: "http://foo.bar/baz" }]
          });

        let ordersStub = get.withArgs({
          uri: API_URL + ENDPOINTS.ORDERS,
          qs: {}
        });
        ordersStub.onFirstCall().rejects({ detail: "iNvalid   Token!!,." });
        ordersStub.onSecondCall().resolves({
          prev: null,
          results: [{ foo: "bar" }, { baz: "qux" }, { qux: "quxx" }],
          next: null
        });

        post = sinon.stub();
        post
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .resolves({ token: authToken2 });
        requestDefaultsStub = sinon
          .stub(requestPromise, "defaults")
          .returns({ get, post });

        instance = new Robinhood();

        expect(requestDefaultsStub.args[0]).to.deep.equal([
          { headers: DEFAULT_HEADERS, gzip: true, json: true }
        ]);
        instance.on(EVENTS.ERROR, errorListenerStub);
        instance.on(EVENTS.CRITICAL, criticalErrorListenerStub);
        instance.authenticate({ authToken: authToken1, credentials });
        instance.once(EVENTS.AUTHENTICATED, done);
      });

      it("authenticates and retries request on invalid token", done => {
        // Setting defaults from #authenticate call
        expect(requestDefaultsStub.args[1]).to.deep.equal([
          { headers: DEFAULT_HEADERS, gzip: true, json: true }
        ]);
        expect(requestDefaultsStub.args[2]).to.deep.equal([
          {
            headers: Object.assign(
              { Authorization: `Token ${authToken1}` },
              DEFAULT_HEADERS
            ),
            gzip: true,
            json: true
          }
        ]);

        instance.getOrders().then(body => {
          // Get accounts for authentication
          expect(get.args[0]).to.deep.equal([
            { uri: "https://api.robinhood.com/accounts/" }
          ]);

          // Get quote the first time, this will fail
          expect(get.args[1]).to.deep.equal([
            {
              uri: API_URL + ENDPOINTS.ORDERS,
              qs: {}
            }
          ]);

          // Reset before #loginWithCredentials call
          expect(requestDefaultsStub.args[3]).to.deep.equal([
            { headers: DEFAULT_HEADERS, gzip: true, json: true }
          ]);

          // Authenticate
          expect(post.lastCall.args).to.deep.equal([
            {
              uri: "https://api.robinhood.com/api-token-auth/",
              form: { password: "baz", username: "foo" }
            }
          ]);
          // Two call to #requestDefaults after receiving authToke from login
          expect(requestDefaultsStub.args[4]).to.deep.equal([
            { headers: DEFAULT_HEADERS, gzip: true, json: true }
          ]);
          expect(requestDefaultsStub.lastCall.args).to.deep.equal([
            {
              headers: Object.assign(
                { Authorization: `Token ${authToken2}` },
                DEFAULT_HEADERS
              ),
              gzip: true,
              json: true
            }
          ]);
          // Request account again after re-authentication
          expect(get.args[2]).to.deep.equal([
            { uri: "https://api.robinhood.com/accounts/" }
          ]);

          // Get quote again after re-authentication occurs
          expect(get.lastCall.args).to.deep.equal([
            {
              uri: API_URL + ENDPOINTS.ORDERS,
              qs: {}
            }
          ]);

          // Finally inspect that the successful response is what we expect
          expect(body).to.deep.equal({
            prev: null,
            results: [{ foo: "bar" }, { baz: "qux" }, { qux: "quxx" }],
            next: null
          });
          expect(errorListenerStub.callCount).to.equal(0);
          expect(criticalErrorListenerStub.callCount).to.equal(0);

          done();
        });
      });

      it("emits critical error if fetching account after login fails", done => {
        accountsStub.reset();
        accountsStub.withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS }).rejects({
          message: "foobar"
        });

        instance.on(EVENTS.CRITICAL, error => {
          expect(errorListenerStub.callCount).to.equal(1);
          expect(errorListenerStub.args[0]).to.deep.equal([
            { type: ERRORS.SETTING_ACCOUNT, message: "foobar" }
          ]);

          expect(error).to.deep.equal({
            type: ERRORS.UNABLE_TO_AUTHENTICATE,
            message: "Invalid token and unable to authenticate"
          });

          done();
        });

        instance.getOrders();
        process.nextTick(() => clock.tick(1000 * 60 * 6)); // 5 minutes
      });

      it("emits critical error if login request fails", done => {
        post.reset();
        post
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .rejects({ message: "bazquxquxx" });

        instance.on(EVENTS.CRITICAL, error => {
          expect(errorListenerStub.callCount).to.equal(1);
          expect(errorListenerStub.args[0]).to.deep.equal([
            { type: ERRORS.AUTHENTICATION, message: "bazquxquxx" }
          ]);

          expect(error).to.deep.equal({
            type: ERRORS.UNABLE_TO_AUTHENTICATE,
            message: "Invalid token and unable to authenticate"
          });

          done();
        });

        instance.getOrders();
        process.nextTick(() => clock.tick(1000 * 60 * 6)); // 5 minutes
      });
    });
  });

  describe("#getOrder", () => {
    let clock, requestStub, requestDefaultsStub, instance, get;

    beforeEach(done => {
      clock = sinon.useFakeTimers();

      get = sinon.stub();
      get.withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS }).resolves({
        results: [{ url: "http://foo.bar/baz" }]
      });
      get
        .withArgs({
          uri: API_URL + ENDPOINTS.ORDER.replace(":orderID", "foo-bar")
        })
        .resolves({
          foo: "bar"
        });
      requestStub = { get };
      requestDefaultsStub = sinon
        .stub(requestPromise, "defaults")
        .returns(requestStub);

      instance = new Robinhood();
      instance.authenticate({ authToken: "foobaz" });
      instance.once(EVENTS.AUTHENTICATED, done);
    });

    afterEach(() => {
      clock.restore();
      requestDefaultsStub.restore();
    });

    it("makes a request to get single order", done => {
      instance.getOrder("foo-bar").then(body => {
        expect(body).to.deep.equal({
          foo: "bar"
        });
        done();
      });
    });

    it("rejects promise on API error", done => {
      get.reset();
      get
        .withArgs({
          uri: API_URL + ENDPOINTS.ORDER.replace(":orderID", "foo-bar")
        })
        .rejects({ detail: "foobar" });

      instance.getOrder("foo-bar").then(
        () => {
          //
        },
        error => {
          expect(error).to.deep.equal({ detail: "foobar" });
          done();
        }
      );
    });

    describe("invalid token handling", () => {
      let authToken1, authToken2, credentials, instance, get, post;
      let accountsStub, errorListenerStub, criticalErrorListenerStub;

      beforeEach(done => {
        // Restore previously set stubs
        clock.restore();
        requestDefaultsStub.restore();

        clock = sinon.useFakeTimers();

        authToken1 = "foobar";
        authToken2 = "foobarbaz";
        credentials = { username: "foo", password: "baz" };
        errorListenerStub = sinon.stub();
        criticalErrorListenerStub = sinon.stub();

        get = sinon.stub();
        accountsStub = get
          .withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS })
          .resolves({
            results: [{ url: "http://foo.bar/baz" }]
          });

        let ordersStub = get.withArgs({
          uri: API_URL + ENDPOINTS.ORDER.replace(":orderID", "baz-qux")
        });
        ordersStub.onFirstCall().rejects({ detail: "iNvalid   Token!!,." });
        ordersStub.onSecondCall().resolves({
          qux: "quxx"
        });

        post = sinon.stub();
        post
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .resolves({ token: authToken2 });
        requestDefaultsStub = sinon
          .stub(requestPromise, "defaults")
          .returns({ get, post });

        instance = new Robinhood();

        expect(requestDefaultsStub.args[0]).to.deep.equal([
          { headers: DEFAULT_HEADERS, gzip: true, json: true }
        ]);
        instance.on(EVENTS.ERROR, errorListenerStub);
        instance.on(EVENTS.CRITICAL, criticalErrorListenerStub);
        instance.authenticate({ authToken: authToken1, credentials });
        instance.once(EVENTS.AUTHENTICATED, done);
      });

      it("authenticates and retries request on invalid token", done => {
        // Setting defaults from #authenticate call
        expect(requestDefaultsStub.args[1]).to.deep.equal([
          { headers: DEFAULT_HEADERS, gzip: true, json: true }
        ]);
        expect(requestDefaultsStub.args[2]).to.deep.equal([
          {
            headers: Object.assign(
              { Authorization: `Token ${authToken1}` },
              DEFAULT_HEADERS
            ),
            gzip: true,
            json: true
          }
        ]);

        instance.getOrder("baz-qux").then(body => {
          // Get accounts for authentication
          expect(get.args[0]).to.deep.equal([
            { uri: "https://api.robinhood.com/accounts/" }
          ]);
          // Get quote the first time, this will fail
          expect(get.args[1]).to.deep.equal([
            {
              uri: API_URL + ENDPOINTS.ORDER.replace(":orderID", "baz-qux")
            }
          ]);

          // Reset before #loginWithCredentials call
          expect(requestDefaultsStub.args[3]).to.deep.equal([
            { headers: DEFAULT_HEADERS, gzip: true, json: true }
          ]);

          // Authenticate
          expect(post.lastCall.args).to.deep.equal([
            {
              uri: "https://api.robinhood.com/api-token-auth/",
              form: { password: "baz", username: "foo" }
            }
          ]);
          // Two call to #requestDefaults after receiving authToke from login
          expect(requestDefaultsStub.args[4]).to.deep.equal([
            { headers: DEFAULT_HEADERS, gzip: true, json: true }
          ]);
          expect(requestDefaultsStub.lastCall.args).to.deep.equal([
            {
              headers: Object.assign(
                { Authorization: `Token ${authToken2}` },
                DEFAULT_HEADERS
              ),
              gzip: true,
              json: true
            }
          ]);
          // Request account again after re-authentication
          expect(get.args[2]).to.deep.equal([
            { uri: "https://api.robinhood.com/accounts/" }
          ]);

          // Get quote again after re-authentication occurs
          expect(get.lastCall.args).to.deep.equal([
            {
              uri: API_URL + ENDPOINTS.ORDER.replace(":orderID", "baz-qux")
            }
          ]);

          // Finally inspect that the successful response is what we expect
          expect(body).to.deep.equal({
            qux: "quxx"
          });
          expect(errorListenerStub.callCount).to.equal(0);
          expect(criticalErrorListenerStub.callCount).to.equal(0);

          done();
        });
      });

      it("emits critical error if fetching account after login fails", done => {
        accountsStub.reset();
        accountsStub.withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS }).rejects({
          message: "foobar"
        });

        instance.on(EVENTS.CRITICAL, error => {
          expect(errorListenerStub.callCount).to.equal(1);
          expect(errorListenerStub.args[0]).to.deep.equal([
            { type: ERRORS.SETTING_ACCOUNT, message: "foobar" }
          ]);

          expect(error).to.deep.equal({
            type: ERRORS.UNABLE_TO_AUTHENTICATE,
            message: "Invalid token and unable to authenticate"
          });

          done();
        });

        instance.getOrder("baz-qux");
        process.nextTick(() => clock.tick(1000 * 60 * 6)); // 5 minutes
      });

      it("emits critical error if login request fails", done => {
        post.reset();
        post
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .rejects({ message: "bazquxquxx" });

        instance.on(EVENTS.CRITICAL, error => {
          expect(errorListenerStub.callCount).to.equal(1);
          expect(errorListenerStub.args[0]).to.deep.equal([
            { type: ERRORS.AUTHENTICATION, message: "bazquxquxx" }
          ]);

          expect(error).to.deep.equal({
            type: ERRORS.UNABLE_TO_AUTHENTICATE,
            message: "Invalid token and unable to authenticate"
          });

          done();
        });

        instance.getOrder("baz-qux");
        process.nextTick(() => clock.tick(1000 * 60 * 6)); // 5 minutes
      });
    });
  });

  describe("#cancelOrder", () => {
    let clock, requestStub, requestDefaultsStub, instance;
    let get, post;

    beforeEach(done => {
      clock = sinon.useFakeTimers();

      get = sinon.stub();
      get.withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS }).resolves({
        results: [{ url: "http://foo.bar/baz" }]
      });

      post = sinon.stub();
      post
        .withArgs({
          uri: API_URL + ENDPOINTS.CANCEL_ORDER.replace(":orderID", "foobar")
        })
        .resolves({});
      post
        .withArgs({
          uri: API_URL + ENDPOINTS.CANCEL_ORDER.replace(":orderID", "bazbar")
        })
        .resolves({ foo: "bazqux" });
      requestStub = { get, post };
      requestDefaultsStub = sinon
        .stub(requestPromise, "defaults")
        .returns(requestStub);

      instance = new Robinhood();
      instance.authenticate({ authToken: "foobaz" });
      instance.once(EVENTS.AUTHENTICATED, done);
    });

    afterEach(() => {
      clock.restore();
      requestDefaultsStub.restore();
    });

    it("resolves immediately if order is in terminal state", done => {
      let promises = [];

      [
        APIOrderState.filled,
        APIOrderState.rejected,
        APIOrderState.canceled,
        APIOrderState.cancelled,
        APIOrderState.failed
      ].forEach(state => {
        promises.push(
          instance.cancelOrder({ state }).then(body => {
            expect(post.callCount).to.equal(0);
            expect(body).to.deep.equal({});
          })
        );
      });

      Promise.all(promises).then(() => done());
    });

    it("sets URL to cancel property", done => {
      let cancel =
        API_URL + ENDPOINTS.CANCEL_ORDER.replace(":orderID", "bazbar");
      instance.cancelOrder({ cancel, id: "foobar" }).then(body => {
        expect(body).to.deep.equal({ foo: "bazqux" });
        done();
      });
    });

    it("sets orderID to id if 'cancel' property is not set", done => {
      instance.cancelOrder({ cancel: null, id: "foobar" }).then(body => {
        expect(body).to.deep.equal({});
        done();
      });
    });

    it("rejects promise on API error", done => {
      post.reset();
      post
        .withArgs({
          uri: API_URL + ENDPOINTS.CANCEL_ORDER.replace(":orderID", "foobar")
        })
        .rejects({ detail: "quxquxx" });

      instance.cancelOrder({ id: "foobar" }).then(
        () => {
          //
        },
        error => {
          expect(error).to.deep.equal({ detail: "quxquxx" });
          done();
        }
      );
    });

    describe("invalid token handling", () => {
      let authToken1, authToken2, credentials, instance, get, post;
      let accountsStub, loginStub, errorListenerStub, criticalErrorListenerStub;

      beforeEach(done => {
        // Restore previously set stubs
        clock.restore();
        requestDefaultsStub.restore();

        clock = sinon.useFakeTimers();

        authToken1 = "foobar";
        authToken2 = "foobarbaz";
        credentials = { username: "foo", password: "baz" };
        errorListenerStub = sinon.stub();
        criticalErrorListenerStub = sinon.stub();

        get = sinon.stub();
        accountsStub = get
          .withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS })
          .resolves({
            results: [{ url: "http://foo.bar/baz" }]
          });

        post = sinon.stub();

        let orderStub = post.withArgs({
          uri: API_URL + ENDPOINTS.CANCEL_ORDER.replace(":orderID", "foobar")
        });
        orderStub.onFirstCall().rejects({ detail: "iNvaLid   Token!!,." });
        orderStub.onSecondCall().resolves({});

        loginStub = post
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .resolves({ token: authToken2 });
        requestDefaultsStub = sinon
          .stub(requestPromise, "defaults")
          .returns({ get, post });

        instance = new Robinhood();

        expect(requestDefaultsStub.args[0]).to.deep.equal([
          { headers: DEFAULT_HEADERS, gzip: true, json: true }
        ]);
        instance.on(EVENTS.ERROR, errorListenerStub);
        instance.on(EVENTS.CRITICAL, criticalErrorListenerStub);
        instance.authenticate({ authToken: authToken1, credentials });
        instance.once(EVENTS.AUTHENTICATED, done);
      });

      it("authenticates and retries request on invalid token", done => {
        let uri =
          API_URL + ENDPOINTS.CANCEL_ORDER.replace(":orderID", "foobar");

        // Setting defaults from #authenticate call
        expect(requestDefaultsStub.args[1]).to.deep.equal([
          { headers: DEFAULT_HEADERS, gzip: true, json: true }
        ]);
        expect(requestDefaultsStub.args[2]).to.deep.equal([
          {
            headers: Object.assign(
              { Authorization: `Token ${authToken1}` },
              DEFAULT_HEADERS
            ),
            gzip: true,
            json: true
          }
        ]);

        instance.cancelOrder({ id: "foobar" }).then(body => {
          // Get accounts for authentication
          expect(get.args[0]).to.deep.equal([
            { uri: "https://api.robinhood.com/accounts/" }
          ]);

          // Post order the first time, this will fail
          expect(post.args[0]).to.deep.equal([{ uri }]);

          // Reset before #loginWithCredentials call
          expect(requestDefaultsStub.args[3]).to.deep.equal([
            { headers: DEFAULT_HEADERS, gzip: true, json: true }
          ]);

          // Authenticate
          expect(post.args[1]).to.deep.equal([
            {
              uri: "https://api.robinhood.com/api-token-auth/",
              form: { password: "baz", username: "foo" }
            }
          ]);
          // Two call to #requestDefaults after receiving authToke from login
          expect(requestDefaultsStub.args[4]).to.deep.equal([
            { headers: DEFAULT_HEADERS, gzip: true, json: true }
          ]);
          expect(requestDefaultsStub.lastCall.args).to.deep.equal([
            {
              headers: Object.assign(
                { Authorization: `Token ${authToken2}` },
                DEFAULT_HEADERS
              ),
              gzip: true,
              json: true
            }
          ]);
          // Request account again after re-authentication
          expect(get.lastCall.args).to.deep.equal([
            { uri: "https://api.robinhood.com/accounts/" }
          ]);

          // Get quote again after re-authentication occurs
          expect(post.lastCall.args).to.deep.equal([{ uri }]);

          // Finally inspect that the successful response is what we expect
          expect(body).to.deep.equal({});
          expect(errorListenerStub.callCount).to.equal(0);
          expect(criticalErrorListenerStub.callCount).to.equal(0);

          done();
        });
      });

      it("emits critical error if fetching account after login fails", done => {
        accountsStub.reset();
        accountsStub.withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS }).rejects({
          message: "foobar"
        });

        instance.on(EVENTS.CRITICAL, error => {
          expect(errorListenerStub.callCount).to.equal(1);
          expect(errorListenerStub.args[0]).to.deep.equal([
            { type: ERRORS.SETTING_ACCOUNT, message: "foobar" }
          ]);

          expect(error).to.deep.equal({
            type: ERRORS.UNABLE_TO_AUTHENTICATE,
            message: "Invalid token and unable to authenticate"
          });

          done();
        });

        instance.cancelOrder({ id: "foobar" });
        process.nextTick(() => clock.tick(1000 * 60 * 6)); // 5 minutes
      });

      it("emits critical error if login request fails", done => {
        loginStub.reset();
        loginStub
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .rejects({ message: "bazquxquxx" });

        instance.on(EVENTS.CRITICAL, error => {
          expect(errorListenerStub.callCount).to.equal(1);
          expect(errorListenerStub.args[0]).to.deep.equal([
            { type: ERRORS.AUTHENTICATION, message: "bazquxquxx" }
          ]);

          expect(error).to.deep.equal({
            type: ERRORS.UNABLE_TO_AUTHENTICATE,
            message: "Invalid token and unable to authenticate"
          });

          done();
        });

        instance.cancelOrder({ id: "foobar" });
        process.nextTick(() => clock.tick(1000 * 60 * 6)); // 5 minutes
      });
    });
  });

  describe("#getAccounts", () => {
    let clock, requestStub, requestDefaultsStub, instance;
    let get, post;

    beforeEach(done => {
      clock = sinon.useFakeTimers();

      get = sinon.stub();
      get.withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS }).resolves({
        results: [{ url: "http://foo.bar/baz" }]
      });
      get.withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS }).resolves({
        prev: null,
        results: [{ foo: "bar" }],
        next: null
      });

      post = sinon.stub();
      requestStub = { get, post };
      requestDefaultsStub = sinon
        .stub(requestPromise, "defaults")
        .returns(requestStub);

      instance = new Robinhood();
      instance.authenticate({ authToken: "foobaz" });
      instance.once(EVENTS.AUTHENTICATED, done);
    });

    afterEach(() => {
      clock.restore();
      requestDefaultsStub.restore();
    });

    it("makes a request to accounts endpoint", done => {
      instance.getAccounts().then(body => {
        expect(body).to.deep.equal({
          prev: null,
          results: [{ foo: "bar" }],
          next: null
        });
        done();
      });
    });

    it("rejects promise on API error", done => {
      get.reset();
      get
        .withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS })
        .rejects({ detail: "quxquxx" });

      instance.getAccounts().then(
        () => {
          //
        },
        error => {
          expect(error).to.deep.equal({ detail: "quxquxx" });
          done();
        }
      );
    });

    describe("invalid token handling", () => {
      let authToken1, authToken2, credentials, instance, get, post;
      let accountsStub, loginStub, errorListenerStub, criticalErrorListenerStub;

      beforeEach(done => {
        // Restore previously set stubs
        clock.restore();
        requestDefaultsStub.restore();

        clock = sinon.useFakeTimers();

        authToken1 = "foobar";
        authToken2 = "foobarbaz";
        credentials = { username: "foo", password: "baz" };
        errorListenerStub = sinon.stub();
        criticalErrorListenerStub = sinon.stub();

        get = sinon.stub();
        accountsStub = get.withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS });
        accountsStub.onFirstCall().resolves({
          results: [{ url: "http://foo.bar/baz" }]
        });
        accountsStub.onSecondCall().rejects({ detail: "iNvaLid   Token!!,." });
        accountsStub.resolves({
          results: [{ url: "http://bar.baz/qux" }]
        });

        post = sinon.stub();

        loginStub = post
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .resolves({ token: authToken2 });
        requestDefaultsStub = sinon
          .stub(requestPromise, "defaults")
          .returns({ get, post });

        instance = new Robinhood();

        expect(requestDefaultsStub.args[0]).to.deep.equal([
          { headers: DEFAULT_HEADERS, gzip: true, json: true }
        ]);
        instance.on(EVENTS.ERROR, errorListenerStub);
        instance.on(EVENTS.CRITICAL, criticalErrorListenerStub);
        instance.authenticate({ authToken: authToken1, credentials });
        instance.once(EVENTS.AUTHENTICATED, done);
      });

      it("authenticates and retries request on invalid token", done => {
        // Setting defaults from #authenticate call
        expect(requestDefaultsStub.args[1]).to.deep.equal([
          { headers: DEFAULT_HEADERS, gzip: true, json: true }
        ]);
        expect(requestDefaultsStub.args[2]).to.deep.equal([
          {
            headers: Object.assign(
              { Authorization: `Token ${authToken1}` },
              DEFAULT_HEADERS
            ),
            gzip: true,
            json: true
          }
        ]);

        instance.getAccounts().then(body => {
          // Get accounts for authentication
          expect(get.args[0]).to.deep.equal([
            { uri: "https://api.robinhood.com/accounts/" }
          ]);

          // Get accounts the first time, this will fail
          expect(get.args[1]).to.deep.equal([
            { uri: "https://api.robinhood.com/accounts/" }
          ]);

          // Reset before #loginWithCredentials call
          expect(requestDefaultsStub.args[3]).to.deep.equal([
            { headers: DEFAULT_HEADERS, gzip: true, json: true }
          ]);

          // Authenticate
          expect(post.args[0]).to.deep.equal([
            {
              uri: "https://api.robinhood.com/api-token-auth/",
              form: { password: "baz", username: "foo" }
            }
          ]);
          // Two call to #requestDefaults after receiving authToke from login
          expect(requestDefaultsStub.args[4]).to.deep.equal([
            { headers: DEFAULT_HEADERS, gzip: true, json: true }
          ]);
          expect(requestDefaultsStub.lastCall.args).to.deep.equal([
            {
              headers: Object.assign(
                { Authorization: `Token ${authToken2}` },
                DEFAULT_HEADERS
              ),
              gzip: true,
              json: true
            }
          ]);
          // Request account again after re-authentication
          expect(get.args[2]).to.deep.equal([
            { uri: "https://api.robinhood.com/accounts/" }
          ]);

          // Get quote again after re-authentication occurs
          expect(get.lastCall.args).to.deep.equal([
            { uri: "https://api.robinhood.com/accounts/" }
          ]);

          // Finally inspect that the successful response is what we expect
          expect(body).to.deep.equal({
            results: [{ url: "http://bar.baz/qux" }]
          });
          expect(errorListenerStub.callCount).to.equal(0);
          expect(criticalErrorListenerStub.callCount).to.equal(0);

          done();
        });
      });

      it("emits critical error if fetching account after login fails", done => {
        accountsStub.reset();
        accountsStub = get.withArgs({ uri: API_URL + ENDPOINTS.ACCOUNTS });
        accountsStub.onFirstCall().rejects({ detail: "iNvaLid   Token!!,." });
        accountsStub.onSecondCall().rejects({
          message: "foobar"
        });

        instance.on(EVENTS.CRITICAL, error => {
          expect(errorListenerStub.callCount).to.equal(1);
          expect(errorListenerStub.args[0]).to.deep.equal([
            { type: ERRORS.SETTING_ACCOUNT, message: "foobar" }
          ]);

          expect(error).to.deep.equal({
            type: ERRORS.UNABLE_TO_AUTHENTICATE,
            message: "Invalid token and unable to authenticate"
          });

          done();
        });

        instance.getAccounts();
        process.nextTick(() => clock.tick(1000 * 60 * 6)); // 5 minutes
      });

      it("emits critical error if login request fails", done => {
        loginStub.reset();
        loginStub
          .withArgs({
            uri: API_URL + ENDPOINTS.LOGIN,
            form: {
              password: credentials.password,
              username: credentials.username
            }
          })
          .rejects({ message: "bazquxquxx" });

        instance.on(EVENTS.CRITICAL, error => {
          expect(errorListenerStub.callCount).to.equal(1);
          expect(errorListenerStub.args[0]).to.deep.equal([
            { type: ERRORS.AUTHENTICATION, message: "bazquxquxx" }
          ]);

          expect(error).to.deep.equal({
            type: ERRORS.UNABLE_TO_AUTHENTICATE,
            message: "Invalid token and unable to authenticate"
          });

          done();
        });

        instance.getAccounts();
        process.nextTick(() => clock.tick(1000 * 60 * 6)); // 5 minutes
      });
    });
  });
});
